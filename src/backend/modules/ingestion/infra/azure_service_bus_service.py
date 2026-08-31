import json
from datetime import datetime, timezone

import structlog
from azure.servicebus import ServiceBusClient, ServiceBusMessage

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)

QUEUE_NAME = "cv-received-queue"


class AzureServiceBusService:
    """Phát sự kiện "đã nhận CV" lên hàng đợi.

    KHÔNG bắt buộc phải cấu hình. Sự kiện này là thông báo cho hệ thống ngoài;
    luồng nhận CV không phụ thuộc vào nó — route tự chạy enrichment bằng
    `background_tasks`, và trong repo hiện chưa có consumer nào đọc hàng đợi.

    Trước đây `__init__` ném ValueError khi thiếu connection string, nên trên
    máy có Blob mà chưa có Service Bus thì MỌI hồ sơ ứng tuyển đều bị từ chối
    — một tính năng phụ chưa bật làm chết cả luồng nghiệp vụ chính.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection_string = settings.azure_service_bus_connection_string
        self._service_bus_client = (
            ServiceBusClient.from_connection_string(self._connection_string)
            if self._connection_string
            else None
        )

    @property
    def enabled(self) -> bool:
        return self._service_bus_client is not None

    def publish_cv_received_event(
        self, candidate_uuid: str, storage_url: str
    ) -> None:
        if self._service_bus_client is None:
            # Ghi log rồi đi tiếp. Im lặng bỏ qua thì không ai biết sự kiện
            # không được phát; ném lỗi thì mất luôn hồ sơ vừa nộp.
            logger.warning(
                "azure.servicebus.not_configured",
                candidate_uuid=candidate_uuid,
                queue_name=QUEUE_NAME,
            )
            return

        event_payload = {
            "candidate_uuid": candidate_uuid,
            "storage_url": storage_url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            with self._service_bus_client:
                sender = self._service_bus_client.get_queue_sender(queue_name=QUEUE_NAME)

                message_body = json.dumps(event_payload)
                message = ServiceBusMessage(message_body)
                sender.send_messages(message)

                logger.info(
                    "azure.servicebus.message_sent",
                    queue_name=QUEUE_NAME,
                    candidate_uuid=candidate_uuid,
                    storage_url=storage_url,
                )

        except Exception as exc:
            logger.error(
                "azure.servicebus.send_failed",
                error=str(exc),
                queue_name=QUEUE_NAME,
                candidate_uuid=candidate_uuid,
            )
            raise RuntimeError(
                f"Failed to send message to Azure Service Bus: {exc}"
            ) from exc

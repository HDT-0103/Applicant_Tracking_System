"""Đọc số liệu THẬT của hàng đợi Service Bus.

Tách khỏi `AzureServiceBusService` vì hai lớp dùng SDK khác nhau: gửi tin dùng
`ServiceBusClient` (data plane), còn đếm tin tồn đọng phải dùng
`ServiceBusAdministrationClient` (management plane). Và quan trọng hơn:
`AzureServiceBusService.__init__` ném lỗi khi thiếu connection string — hợp lý
cho đường gửi tin, nhưng màn hình giám sát thì phải hiện được "chưa cấu hình"
thay vì sập.
"""

from dataclasses import dataclass
from typing import Optional

import structlog

from modules.ingestion.infra.azure_service_bus_service import QUEUE_NAME
from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class QueueHealth:
    """Tình trạng hàng đợi.

    `active_messages` và `deadletter_messages` là `None` khi KHÔNG đọc được —
    khác hẳn với 0. Trước đây chỗ này trả 0 cứng, nên một Service Bus chết vẫn
    hiện lên bảng điều khiển y như một hàng đợi rỗng đang chạy tốt.
    """

    queue_name: str
    #: not_configured | unavailable | degraded | healthy
    status: str
    active_messages: Optional[int] = None
    deadletter_messages: Optional[int] = None
    #: Vì sao không phải `healthy`. Hiện thẳng cho admin, khỏi phải đi đọc log.
    detail: Optional[str] = None


def read_queue_health(settings: Settings) -> QueueHealth:
    connection_string = settings.azure_service_bus_connection_string
    if not connection_string:
        return QueueHealth(
            queue_name=QUEUE_NAME,
            status="not_configured",
            detail="AZURE_SERVICE_BUS_CONNECTION_STRING is not set.",
        )

    try:
        # Import tại chỗ: máy dev không có Azure vẫn chạy được phần còn lại của
        # trang admin thay vì hỏng ngay từ lúc nạp module.
        from azure.servicebus.management import ServiceBusAdministrationClient

        with ServiceBusAdministrationClient.from_connection_string(
            connection_string
        ) as client:
            props = client.get_queue_runtime_properties(QUEUE_NAME)
    except Exception as exc:
        logger.warning(
            "azure.servicebus.runtime_props_failed", queue_name=QUEUE_NAME, error=str(exc)
        )
        return QueueHealth(
            queue_name=QUEUE_NAME,
            status="unavailable",
            detail=f"Could not reach the queue: {exc}",
        )

    active = props.active_message_count
    deadletter = props.dead_letter_message_count

    # Tin nằm trong deadletter là CV đã nhận nhưng xử lý hỏng và hết lượt thử
    # lại. Đó là hồ sơ ứng viên đang mất tích, nên không thể coi là "healthy".
    if deadletter:
        return QueueHealth(
            queue_name=QUEUE_NAME,
            status="degraded",
            active_messages=active,
            deadletter_messages=deadletter,
            detail=f"{deadletter} message(s) in the dead-letter queue — those CVs were never processed.",
        )

    return QueueHealth(
        queue_name=QUEUE_NAME,
        status="healthy",
        active_messages=active,
        deadletter_messages=deadletter,
    )

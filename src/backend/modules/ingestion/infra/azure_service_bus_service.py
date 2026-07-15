import json
from datetime import datetime, timezone

import structlog
from azure.servicebus import ServiceBusClient, ServiceBusMessage

from modules.shared.infrastructure.config import Settings

logger = structlog.get_logger(__name__)

QUEUE_NAME = "cv-received-queue"


class AzureServiceBusService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connection_string = settings.azure_service_bus_connection_string

        if not self._connection_string:
            raise ValueError("AZURE_SERVICE_BUS_CONNECTION_STRING is not configured")

        self._service_bus_client = ServiceBusClient.from_connection_string(
            self._connection_string
        )

    def publish_cv_received_event(
        self, candidate_uuid: str, storage_url: str
    ) -> None:
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

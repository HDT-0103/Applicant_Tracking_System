# Azure Setup for Ingestion Pipeline

## 1. Azure Blob Storage

```bash
# Create storage account
az storage account create --name smartatsstorage --resource-group smartats-rg --sku Standard_GRS

# Get connection string
az storage account show-connection-string --name smartatsstorage --resource-group smartats-rg

# Create container candidate-cvs
az storage container create --name candidate-cvs --account-name smartatsstorage
```

Set `AZURE_STORAGE_CONNECTION_STRING` in .env.

## 2. Azure Service Bus

```bash
# Create namespace
az servicebus namespace create --name smartats-queue --resource-group smartats-rg

# Create queue cv-received-queue
az servicebus queue create --namespace-name smartats-queue --name cv-received-queue
```

Set `AZURE_SERVICE_BUS_CONNECTION_STRING` in .env.

## 3. Container Structure

```
candidate-cvs/
├── {candidate_uuid}.pdf     # Raw uploaded CVs
```

## 4. SAS URL Generation

Used by the frontend/enrichment to download PDFs securely:

```python
from azure.storage.blob import generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta

sas_url = generate_blob_sas(
    account_name="smartatsstorage",
    container_name="candidate-cvs",
    blob_name=f"{uuid}.pdf",
    account_key=account_key,
    permission=BlobSasPermissions(read=True),
    expiry=datetime.utcnow() + timedelta(hours=1)
)
```


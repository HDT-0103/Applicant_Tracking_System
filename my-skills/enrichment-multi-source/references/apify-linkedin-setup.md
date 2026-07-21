# Apify LinkedIn Scraper Setup

## Actor: GOvL4O4RwFqsdIqXF

SmartATS uses the Apify Actor `GOvL4O4RwFqsdIqXF` for LinkedIn profile scraping.

## Setup

1. Create an Apify account at https://apify.com
2. Get your API token from Settings → Integrations
3. Set `APIFY_API_TOKEN` in .env

## Input Format

```json
{
  "profileUrls": ["https://www.linkedin.com/in/username/"],
  "usernames": ["username"],
  "proxyConfiguration": { "useApifyProxy": true },
  "includeEmail": false
}
```

## Output Data Structure

```json
{
  "basic_info": {
    "fullname": "Maya Lindqvist",
    "headline": "Senior ML Engineer at Company",
    "profile_picture_url": "https://...",
    "location": "Stockholm, Sweden"
  },
  "experience": [
    {
      "title": "Senior ML Engineer",
      "company": "Company",
      "start_date": { "month": 1, "year": 2020 },
      "end_date": { "month": null, "year": null },
      "description": "..."
    }
  ],
  "education": [
    {
      "school": "KTH Royal Institute of Technology",
      "degree": "Master's degree",
      "field_of_study": "Machine Learning",
      "start_date": { "month": 8, "year": 2015 },
      "end_date": { "month": 6, "year": 2017 }
    }
  ]
}
```

## URL Normalization

The service normalizes LinkedIn URLs before sending to Apify:
- Ensures `www.linkedin.com` (not `linkedin.com`)
- Ensures trailing slash
- Extracts username from URL path

# Overview

Copy for LLM

The Apify API client is the official library to access the [Apify REST API](https://docs.apify.com/api/v2) from your JavaScript/TypeScript applications. It runs both in Node.js and browser and provides useful features like automatic retries and convenience functions that improve the experience of using the Apify API.

The client simplifies interaction with the Apify platform by providing:

* Intuitive methods for working with [Actors](https://docs.apify.com/platform/actors), [datasets](https://docs.apify.com/platform/storage/dataset), [key-value stores](https://docs.apify.com/platform/storage/key-value-store), and other Apify resources
* Intelligent parsing of API responses and rich error messages for debugging
* Built-in [exponential backoff](https://docs.apify.com/api/client/js/api/client/js/docs/concepts/error-handling.md#retries-with-exponential-backoff) for failed requests
* Full TypeScript support with comprehensive type definitions
* Cross-platform compatibility in [Node.js](https://nodejs.org/) v16+ and modern browsers

All requests and responses (including errors) are encoded in JSON format with UTF-8 encoding.

## Pre-requisites[](#pre-requisites)

`apify-client` requires Node.js version 16 or higher. Node.js is available for download on the [official website](https://nodejs.org/). Check for your current Node.js version by running:

```
node -v
```

## Installation[](#installation)

You can install the client via [NPM](https://www.npmjs.com/) or any other package manager of your choice.

* NPM
* Yarn
* PNPM
* Bun

```
npm i apify-client
```

```
yarn add apify-client
```

```
pnpm add apify-client
```

```
bun add apify-client
```

## Quick example[](#quick-example)

Here's an example showing how to run an Actor and retrieve its results:

```
import { ApifyClient } from 'apify-client';



// Initialize the client with your API token

const client = new ApifyClient({

    token: 'MY-APIFY-TOKEN',

});



// Start an Actor and wait for it to finish

const run = await client.actor('apify/web-scraper').call({

    startUrls: [{ url: 'https://example.com' }],

    maxCrawlPages: 10,

});



// Get results from the Actor's dataset

const { items } = await client.dataset(run.defaultDatasetId).listItems();

console.log(items);
```

# ApePay

[![Ape Framework](https://img.shields.io/badge/Built%20with-Ape%20Framework-brightgreen.svg)](https://apeworx.io)

A smart contract payment system built for automated service management

## About

See the [blog post](https://mirror.xyz/apeworx.eth/XPAko-Ez-BqHJF5zaB9sG8kfuDutNn1TqPg4827C7fw) to learn more about ApePay!

## Documentation

Coming soon!

## Contributing

ApePay is open source and we welcome all contributors! Check out the following to get started.

TODOs:

- [x] Initial implementation
- [ ] Documentation
- [x] Live testing on Sepolia
- [x] Production deployment on Arbitrum
- [ ] Frontend management console, for managing subscriptions

### Setup (Python)

First, [install Ape](https://docs.apeworx.io/ape/stable/userguides/quickstart.html#installation)

Second, make sure to install the plugins:

```sh
$ ape plugins install . --upgrade
```

Next, prior to installing the SDK package, you have to compile the project:

```sh
$ ape compile
```

```note
The SDK package relies on a soft link in [`./sdk/py/apepay/manifest.json`](./sdk/py/apepay/manifest.json)
```

Lastly, install the SDK package via:

```sh
$ poetry install
```

Then you are ready to contribute!

### Setup (JS)

In order to contribute to the JS SDK and React component library, or to build the demo app, you need to first follow the [Python Setup instructions](#setup-python) to compile the smart contract package.

Next, you need install the node packages for development:

```sh
$ npm install
```

In order to work on the React component library, you need to compile the JS SDK:

```sh
$ npm run build --workspace=sdk/js
```

In order to work on the Demo app, you need to compile the JS SDK (like above) as well as compile the React component library:

```sh
$ npm run build --workspace=ui/lib
```

Then you are ready to contribute!

To run the demo app in development mode, do the following:

```sh
$ npm run dev --workspace=ui/app
```

To build the demo app for production, do the following:

```sh
$ npm run build --workspace=ui/app
```

### Testing

To run tests, just use Ape:

```sh
$ ape test
```

To see gas usage, add the `--gas` flag:

```sh
$ ape test --gas
```

### Scripts

To deploy a StreamManager (for testing purposes), run:

```sh
$ ape run deploy manager [TOKEN_ADDRESS [...]]
# Or if `ape tokens` is installed with a valid tokenlist
$ ape run deploy manager [TOKEN_SYMBOL [...]]
```

To deploy the StreamFactory (for production use), run:

```sh
$ ape run deploy factory
```

To deploy a Token (for testing use only), run:

```sh
$ ape run deploy token
```

```note
This test token has an unauthenticated mint, please do not use in production!
```

To run the demo ApePay cluster daemon, first run a node like `anvil`:

```sh
$ anvil --derivation-path "m/44'/60'/0'/" --block-time 1 --prune-history
```

**NOTE**: the `--derivation-path` flag makes ape's test accounts match anvil's

Then run the daemon:

```sh
$ silverback run scripts.daemon:app --network ::foundry --account TEST::0
```

After that, it's suggested to start `ape console` and create a stream to watch the daemon react

## License

ApePay is licensed [Apache 2.0](./LICENSE)

# Multiplayer Online Game

[中文](README.MD) | [English](README.EN.MD)  

## Some Ramblings

- I haven't conducted a very thorough test, so I don't know if there will be any synchronization failures.
- I've tested it on Windows Chrome and Windows Firefox (sometimes the "connect" button doesn't respond in Firefox...).
- It can also be used on Android browsers, but there seem to be relatively significant performance issues.

## Running the Online Server

My server is hosted on Alibaba Cloud in Guangzhou, and the device configuration is relatively low.
The server is based on Node.js. Through testing, it has been found that both Bun and Deno can also run it.
You may want to use your own device as the online server.

- Download: [server.cjs](https://github.com/gimhol/Little-Fighter-Wemake/releases/tag/v0.1.0)

- Install a runtime environment (choose one): [Node.js](https://nodejs.org/) | [Bun](https://bun.sh/) | [Deno](https://deno.com/)

- Command line (select one according to the installed runtime environment)

  | Runtime Environment | Command |
  | ---- | ---- |
  | Node.js | `node ./server.cjs` |
  | Bun | `bun ./server.cjs` |
  | Deno | `deno ./server.cjs` |

- By default, it will run on `ws://localhost:80`. For more configurations, refer to "Online Server Configuration".

## Online Server Configuration

- You need to create a file named `.env`.
- Content in the `.env` file (no spaces are needed on either side of the equal sign):

  ``` plaintext
  HTTP_PORT=80
  HTTPS_PORT=443
  SSL_KEY_FILE_PATH=any_ssl_key_file_path_if_u_need_ssl
  SSL_CER_FILE_PATH=any_ssl_cert_file_path_if_u_need_ssl
  ```
  
## Incidentally

Normally, if your server does not support HTTPS,
the games running on [lf.gim.ink](https://lf.gim.ink) will not be able to connect to your server.

Unless you allow "insecure connections" in the HTTPS page in your browser.

If you are using Firefox, you can google for "How to set network.websocket.allowInsecureFromHTTPS in Firefox".
If you are using Chrome, you can google for "How to allow Chrome (browser) to load insecure content?".

**If you make these changes, be sure to remember to restore these settings!!!**

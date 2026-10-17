import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createConnection, type Socket } from "node:net";
import type { Readable } from "node:stream";

@Injectable()
export class ClamAvScanner {
  private readonly host: string;
  private readonly port: number;

  constructor(config: ConfigService) {
    this.host = config.getOrThrow<string>("CLAMAV_HOST");
    this.port = config.getOrThrow<number>("CLAMAV_PORT");
  }

  scan(stream: Readable): Promise<"CLEAN" | "INFECTED"> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      let response = "";
      let settled = false;
      const finish = (error?: Error, result?: "CLEAN" | "INFECTED") => {
        if (settled) return;
        settled = true;
        stream.destroy();
        socket.destroy();
        if (error) reject(error);
        else resolve(result!);
      };
      const parseResponse = () => {
        const text = response.replace(/\0/gu, "").trim();
        if (text.endsWith("OK")) finish(undefined, "CLEAN");
        else if (text.includes("FOUND")) finish(undefined, "INFECTED");
        else if (text) finish(new Error("ClamAV вернул ошибку проверки"));
      };

      socket.setTimeout(120_000, () => finish(new Error("Истекло время ожидания ClamAV")));
      socket.once("error", (error) => finish(error));
      socket.on("data", (chunk: Buffer) => {
        response += chunk.toString("utf8");
        if (response.includes("\0")) parseResponse();
      });
      socket.once("end", () => {
        parseResponse();
        if (!settled) finish(new Error("ClamAV завершил соединение без ответа"));
      });
      socket.once("close", () => {
        if (!settled) finish(new Error("ClamAV закрыл соединение без результата проверки"));
      });
      socket.on("connect", () => {
        void this.sendStream(socket, stream).catch((error: unknown) =>
          finish(error instanceof Error ? error : new Error("Не удалось проверить файл")),
        );
      });
    });
  }

  private async sendStream(socket: Socket, stream: Readable): Promise<void> {
    await writeChunk(socket, Buffer.from("zINSTREAM\0"));
    for await (const chunk of stream) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      const header = Buffer.allocUnsafe(4);
      header.writeUInt32BE(data.length, 0);
      await writeChunk(socket, header);
      await writeChunk(socket, data);
    }
    if (socket.destroyed) return;
    await writeChunk(socket, Buffer.alloc(4));
  }
}

async function writeChunk(socket: Socket, chunk: Buffer): Promise<void> {
  if (socket.destroyed || !socket.writable) {
    throw new Error("ClamAV закрыл соединение во время отправки файла");
  }
  if (socket.write(chunk)) return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      socket.off("drain", onDrain);
      socket.off("close", onClose);
      socket.off("error", onError);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onDrain = () => finish();
    const onClose = () => finish(new Error("ClamAV закрыл соединение во время отправки файла"));
    const onError = (error: Error) => finish(error);

    socket.once("drain", onDrain);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

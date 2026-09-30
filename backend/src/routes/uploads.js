/**
 * uploads.js — Upload e serviço de imagens para descrições de tarefas.
 *
 * POST /uploads/images  (autenticado, multipart) → grava a imagem em disco e
 *   retorna { url } com a URL pública (servida por @fastify/static).
 * GET  /uploads/file/*  → serve os arquivos gravados. URLs contêm um UUID
 *   não-adivinhável; o acesso é público porque tags <img> não enviam o header
 *   Authorization.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { authenticate } from "../auth.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const UPLOADS_DIR =
  process.env.UPLOADS_DIR ||
  (process.env.NODE_ENV === "production"
    ? "/data/uploads"
    : path.join(process.cwd(), "uploads"));

export default async function uploadsRoutes(fastify) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  await fastify.register(multipart, {
    limits: { fileSize: MAX_BYTES, files: 1 },
  });

  // Serve os arquivos enviados em /uploads/file/*
  await fastify.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: "/uploads/file/",
    decorateReply: false,
  });

  fastify.post(
    "/images",
    { preHandler: authenticate },
    async (req, reply) => {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: "Nenhum arquivo enviado." });
      }

      const ext = MIME_EXT[data.mimetype];
      if (!ext) {
        return reply
          .status(400)
          .send({ error: "Tipo de imagem não suportado (use PNG, JPEG, WebP ou GIF)." });
      }

      const userDir = path.join(UPLOADS_DIR, req.userId);
      fs.mkdirSync(userDir, { recursive: true });

      const filename = `${randomUUID()}.${ext}`;
      const filepath = path.join(userDir, filename);

      try {
        await fs.promises.writeFile(filepath, await data.toBuffer());
      } catch (err) {
        // @fastify/multipart lança se exceder o fileSize configurado.
        if (data.file?.truncated || err?.code === "FST_REQ_FILE_TOO_LARGE") {
          return reply.status(413).send({ error: "Imagem muito grande (máx 5MB)." });
        }
        throw err;
      }

      if (data.file?.truncated) {
        await fs.promises.unlink(filepath).catch(() => {});
        return reply.status(413).send({ error: "Imagem muito grande (máx 5MB)." });
      }

      return {
        url: `/api/uploads/file/${req.userId}/${filename}`,
        filename,
        size: data.file?.bytesRead,
      };
    }
  );
}

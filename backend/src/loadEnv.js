import dotenv from "dotenv";

// Carrega o .env do projeto ANTES de qualquer outro módulo (especialmente o
// prisma.js, que instancia o PrismaClient e lê DATABASE_URL na construção).
//
// `override: true` garante que o .env deste projeto tenha precedência sobre
// variáveis já presentes no ambiente do SO. Isso evita que uma DATABASE_URL
// poluída por outro projeto (ex.: uma URL postgres global) sobrescreva a
// configuração sqlite local e cause "the URL must start with the protocol file:".
//
// Em produção (Docker) não existe arquivo .env na imagem, então nada é
// sobrescrito e as variáveis injetadas pelo docker-compose permanecem válidas.
dotenv.config({ override: true });

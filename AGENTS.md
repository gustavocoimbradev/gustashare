# Instruções para agentes

- Não rode `npm run build` / `vite build` / `electron-builder` depois de fazer ajustes de código a pedido do usuário. Ele mesmo builda quando quiser testar. Só é ok rodar build se ele pedir explicitamente pra validar/gerar o `.exe`.
- Pode (e deve) usar `node --check <arquivo>` pra validar sintaxe rapidamente sem precisar de build completo.

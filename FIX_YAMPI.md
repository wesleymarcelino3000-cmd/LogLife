# Correção Yampi Sync

Alterações feitas:

- A rota `/api/yampi-sync` agora usa `YAMPI_TOKEN`, `YAMPI_SECRET` e `YAMPI_ALIAS` do servidor/Vercel quando existirem.
- O `User-Secret-Key` não fica mais dependente apenas do frontend.
- Adicionada validação de credenciais incompletas.
- Adicionado timeout de 30 segundos nas consultas à Yampi.
- Melhorado log de erro da API, sem cortar em apenas 100 caracteres.
- A resposta da Yampi agora é lida como texto e JSON, evitando perder mensagens de erro.
- `.env.example` atualizado com variáveis da Yampi.

No Vercel, configure:

```env
YAMPI_TOKEN=seu_user_token_yampi
YAMPI_SECRET=seu_user_secret_key_yampi
YAMPI_ALIAS=sua_loja_yampi
```

Depois faça redeploy do projeto.

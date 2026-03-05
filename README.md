https://www.prisma.io/docs/prisma-orm/quickstart/postgresql

https://www.prisma.io/docs/orm/prisma-schema/overview/location

### Gera o Prisma Client juntamente
```bash
(npx prisma generate)
npx prisma migrate dev
```

### Isso aqui gera tudo de novo se der alguma M#$*@
```bash
rm -rf node_modules/.prisma
npx prisma generate
```
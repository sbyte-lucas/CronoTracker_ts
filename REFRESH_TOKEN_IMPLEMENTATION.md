# Implementação de Refresh Token no Sistema

![alt text](image.png)

## 📋 Visão Geral

O Refresh Token é um mecanismo de segurança que permite renovar o Access Token sem que o usuário precise fazer login novamente. O fluxo funciona assim:

- **Access Token**: Token de curta duração (15-30 minutos) usado para autenticar as requisições
- **Refresh Token**: Token de longa duração (7 dias) armazenado no banco de dados, usado para gerar novos Access Tokens

## 📐 Arquitetura

```
Cliente faz login
     ↓
Servidor retorna Access Token + Refresh Token
     ↓
Cliente faz requisições com Access Token
     ↓
Access Token expira? → Cliente usa Refresh Token para gerar novo Access Token
     ↓
Servidor valida Refresh Token e retorna novo Access Token
```

---

## 🔧 Passo 1: Atualizar o Schema Prisma

Adicione um modelo para armazenar os refresh tokens:

```prisma
// Em prisma/schema.prisma, adicione:

model refresh_tokens {
  id              Int       @id @default(autoincrement())
  usuario_id      Int       @unique
  token           String    @unique
  expira_em       DateTime
  criado_em       DateTime  @default(now())

  usuario         usuarios  @relation(fields: [usuario_id], references: [usuario_id], onDelete: Cascade)
}
```

**Atualizar o modelo `usuarios` para incluir o relacionamento:**

```prisma
model usuarios {
  usuario_id     Int            @id @default(autoincrement())
  nome_usuario   String         @unique @db.VarChar(50)
  hash_senha     String
  nome_completo  String?        @db.VarChar(100)
  email          String?        @unique @db.VarChar(100)
  cargo          String?        @db.VarChar(20)
  status         Boolean        @default(true)
  colaborador_id Int?           @unique

  logs_acesso       logs_acesso[]
  colaborador       colaboradores? @relation(fields: [colaborador_id], references: [colaborador_id], onDelete: Cascade)
  refresh_token     refresh_tokens? // Nova relação
}
```

**Executar migração:**

```bash
npx prisma migrate dev --name add_refresh_tokens
npx prisma generate
```

---

## 🌍 Passo 2: Atualizar Variáveis de Ambiente

Adicione no arquivo `.env`:

```env
# JWT Secrets
JWT_SECRET=sua_chave_secreta_super_segura_aqui
JWT_REFRESH_SECRET=sua_chave_refresh_super_segura_diferente_aqui

# JWT Expirations
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Outros
DATABASE_URL=postgresql://usuario:senha@localhost:5432/backoffice
```

---

## 🎯 Passo 3: Atualizar Tipos TypeScript

Atualize o arquivo `src/types/index.ts`:

```typescript
export interface JwtPayload {
  usuarioId: number;
  cargo?: string;
  nomeUsuario: string;
  colaborador_id?: number;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  usuarioId: number;
  tokenId: number;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
```

---

## 🔐 Passo 4: Atualizar Controller de Login

Substitua o conteúdo de `src/controllers/login.ts`:

```typescript
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { RefreshTokenPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
const JWT_REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || '7d';

interface LoginBody {
  nome_usuario: string;
  senha: string;
}

export const login = async (
  req: Request<{}, {}, LoginBody>,
  res: Response
): Promise<void> => {
  const { nome_usuario, senha } = req.body;

  if (!nome_usuario || !senha) {
    res.status(400).json({ error: "Campos obrigatórios." });
    return;
  }

  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { nome_usuario }
    });

    if (!usuario) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }

    const senhaValida = await bcrypt.compare(senha, usuario.hash_senha);
    if (!senhaValida) {
      res.status(401).json({ error: "Credenciais inválidas." });
      return;
    }

    // Gerar Access Token
    const accessToken = jwt.sign(
      {
        usuarioId: usuario.usuario_id,
        cargo: usuario.cargo,
        nomeUsuario: usuario.nome_usuario,
        colaborador_id: usuario.colaborador_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Deletar token antigo se existir
    await prisma.refresh_tokens.deleteMany({
      where: { usuario_id: usuario.usuario_id }
    });

    // Gerar Refresh Token
    const refreshTokenId = await generateRefreshToken(usuario.usuario_id);

    res.json({
      message: "Login bem-sucedido!",
      accessToken,
      refreshToken: refreshTokenId.token,
      user: {
        usuario_id: usuario.usuario_id,
        nome_usuario: usuario.nome_usuario,
        cargo: usuario.cargo,
        nome_completo: usuario.nome_completo,
        colaborador_id: usuario.colaborador_id,
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: "Erro interno." });
  }
};

/**
 * Gerar novo Refresh Token
 */
async function generateRefreshToken(usuarioId: number) {
  // Calcular data de expiração
  const expiresIn = parseInt(JWT_REFRESH_EXPIRATION) || 604800000; // 7 dias em ms
  
  const refreshTokenRecord = await prisma.refresh_tokens.create({
    data: {
      usuario_id: usuarioId,
      token: jwt.sign(
        { usuarioId },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRATION }
      ),
      expira_em: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) // 7 dias
    }
  });

  return refreshTokenRecord;
}

/**
 * Endpoint para renovar o Access Token
 */
export const refreshToken = async (
  req: Request<{}, {}, { refreshToken: string }>,
  res: Response
): Promise<void> => {
  const { refreshToken: tokenProvided } = req.body;

  if (!tokenProvided) {
    res.status(400).json({ error: "Refresh token não fornecido" });
    return;
  }

  try {
    // Validar o refresh token no banco
    const tokenRecord = await prisma.refresh_tokens.findUnique({
      where: { token: tokenProvided },
      include: { usuario: true }
    });

    if (!tokenRecord) {
      res.status(401).json({ error: "Refresh token inválido ou expirado" });
      return;
    }

    // Verificar se expirou
    if (new Date() > tokenRecord.expira_em) {
      // Deletar token expirado
      await prisma.refresh_tokens.delete({
        where: { id: tokenRecord.id }
      });
      res.status(401).json({ error: "Refresh token expirado" });
      return;
    }

    // Validar assinatura do JWT
    try {
      jwt.verify(tokenProvided, JWT_REFRESH_SECRET);
    } catch (error) {
      res.status(401).json({ error: "Refresh token inválido" });
      return;
    }

    const usuario = tokenRecord.usuario;

    // Gerar novo Access Token
    const newAccessToken = jwt.sign(
      {
        usuarioId: usuario.usuario_id,
        cargo: usuario.cargo,
        nomeUsuario: usuario.nome_usuario,
        colaborador_id: usuario.colaborador_id
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.json({
      message: "Token renovado com sucesso!",
      accessToken: newAccessToken,
      user: {
        usuario_id: usuario.usuario_id,
        nome_usuario: usuario.nome_usuario,
        cargo: usuario.cargo,
        nome_completo: usuario.nome_completo,
        colaborador_id: usuario.colaborador_id,
      }
    });
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    res.status(500).json({ error: "Erro interno." });
  }
};

/**
 * Logout: Deletar o refresh token
 */
export const logout = async (
  req: Request<{}, {}, { refreshToken: string }>,
  res: Response
): Promise<void> => {
  const { refreshToken: tokenProvided } = req.body;

  if (!tokenProvided) {
    res.status(400).json({ error: "Refresh token não fornecido" });
    return;
  }

  try {
    await prisma.refresh_tokens.delete({
      where: { token: tokenProvided }
    });

    res.json({ message: "Logout realizado com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao fazer logout" });
  }
};

export default { login, refreshToken, logout };
```

---

## 📍 Passo 5: Atualizar Rotas

Adicione as novas rotas em `src/router/index.ts`:

```typescript
// ... imports existentes ...
import loginController from '../controllers/login';

const router = Router();

// Autenticação
router.post("/login", loginController.login);
router.post("/refresh-token", loginController.refreshToken);  // Nova rota
router.post("/logout", loginController.logout);               // Nova rota

// ... resto das rotas ...

export default router;
```

---

## 🔒 Passo 6: Atualizar Middleware de Autenticação

Atualize `src/middlewares/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, AuthenticatedRequest } from '../types';

const JWT_SECRET = process.env.JWT_SECRET as string;

const pathsToIgnore = [
  '/login', 
  '/refresh-token',
  '/logout'
];

/**
 * Middleware de autenticação JWT
 * Verifica o token no header Authorization e adiciona o usuário ao request
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (pathsToIgnore.includes(req.path)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Token não fornecido' });
      return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      res.status(401).json({ error: 'Token mal formatado' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ 
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    res.status(500).json({ error: 'Erro ao validar token' });
  }
};

export default { authMiddleware };
```

---

## 🧪 Passo 7: Testando com cURL

### 1. Fazer Login

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "nome_usuario": "seu_usuario",
    "senha": "sua_senha"
  }'
```

**Resposta esperada:**
```json
{
  "message": "Login bem-sucedido!",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "usuario_id": 1,
    "nome_usuario": "seu_usuario",
    "cargo": "admin",
    "nome_completo": "Seu Nome",
    "colaborador_id": 1
  }
}
```

### 2. Usar Access Token na Requisição

```bash
curl -X GET http://localhost:3000/colaboradores \
  -H "Authorization: Bearer seu_access_token_aqui"
```

### 3. Renovar Token

```bash
curl -X POST http://localhost:3000/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "seu_refresh_token_aqui"
  }'
```

**Resposta esperada:**
```json
{
  "message": "Token renovado com sucesso!",
  "accessToken": "novo_access_token_aqui",
  "user": { ... }
}
```

### 4. Logout

```bash
curl -X POST http://localhost:3000/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "seu_refresh_token_aqui"
  }'
```

---

## 🎨 Passo 8: Fluxo no Frontend

### Login
```javascript
const response = await fetch('http://localhost:3000/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nome_usuario: 'usuario',
    senha: 'senha'
  })
});

const data = await response.json();
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
```

### Fazer Requisição Autenticada
```javascript
const response = await fetch('http://localhost:3000/colaboradores', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

if (response.status === 401) {
  // Token expirou, renovar
  const refreshResponse = await fetch('http://localhost:3000/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refreshToken: localStorage.getItem('refreshToken')
    })
  });

  const newData = await refreshResponse.json();
  localStorage.setItem('accessToken', newData.accessToken);
  
  // Tentar requisição novamente com novo token
  return fetch('http://localhost:3000/colaboradores', {
    headers: {
      'Authorization': `Bearer ${newData.accessToken}`
    }
  });
}

return response;
```

---

## 📊 Tabela Comparativa

| Aspecto | Access Token | Refresh Token |
|---------|--------------|---------------|
| **Duração** | 15 minutos | 7 dias |
| **Uso** | Autenticar requisições | Gerar novo Access Token |
| **Armazenamento** | Memória/LocalStorage | Banco de dados |
| **Segurança** | Expira rápido | Menor risco se comprometido |
| **Renovação** | Automática via Refresh | Manual (logout) |

---

## ⚠️ Considerações de Segurança

1. **Nunca exponha o JWT_REFRESH_SECRET**: Use variáveis de ambiente
2. **Sempre valide token no banco**: Não confie apenas na assinatura JWT
3. **Implemente rate limiting**: Previna brute force no endpoint `/refresh-token`
4. **Use HTTPS**: Em produção, sempre use conexões seguras
5. **Token rotation**: Considere gerar novo refresh token a cada renovação
6. **Logout**: Sempre delete o refresh token na saída do usuário

---

## 🚀 Resumo dos Passos

- [ ] 1. Atualizar schema Prisma com `refresh_tokens`
- [ ] 2. Executar migração Prisma
- [ ] 3. Adicionar variáveis de ambiente (`.env`)
- [ ] 4. Atualizar tipos TypeScript
- [ ] 5. Reescrever controller de login
- [ ] 6. Adicionar rotas para refresh e logout
- [ ] 7. Atualizar middleware de autenticação
- [ ] 8. Testar com cURL ou Postman
- [ ] 9. Implementar no frontend
- [ ] 10. Revisar segurança

---

## 📝 Exemplo Completo de .env

```env
# Database
DATABASE_URL=postgresql://usuario:senha@localhost:5432/backoffice

# JWT Configuration
JWT_SECRET=sua_chave_super_secreta_com_no_minimo_32_caracteres_aleatorios
JWT_REFRESH_SECRET=sua_chave_refresh_super_secreta_diferente_com_no_minimo_32_caracteres
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Server
PORT=3000
NODE_ENV=development
```

---

Pronto! Seu sistema agora está pronto para suportar refresh tokens de forma segura e escalável! 🎉

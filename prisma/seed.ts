import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface MockCliente {
  nome_cliente: string;
  nome_contato: string;
  cnpj?: string;
  cep?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  status: boolean;
}

interface MockColaborador {
  nome_colaborador: string;
  cargo: string;
  email: string;
  status: boolean;
}

interface MockProjeto {
  nome_projeto: string;
  descricao: string;
  status: string;
  horas_previstas: number;
  cliente_id: number;
}

interface MockUsuario {
  nome_usuario: string;
  nome_completo: string;
  email: string;
  cargo: string;
  hash_senha: string;
  status: boolean;
}

interface MockData {
  clientes: MockCliente[];
  colaboradores: MockColaborador[];
  projetos: MockProjeto[];
  usuarios: MockUsuario[];
}

async function main(): Promise<void> {
  try {
    console.log("🌱 Iniciando seed do banco de dados...\n");

    // Ler arquivo de mock data
    const mockDataPath = path.join(process.cwd(), "prisma", "mock-data.json");
    const mockData: MockData = JSON.parse(fs.readFileSync(mockDataPath, "utf-8"));

    // Limpar dados existentes (ordem importa por causa de FKs)
    console.log("🗑️  Limpando dados existentes...");
    await prisma.logs_acesso.deleteMany({});
    await prisma.usuarios.deleteMany({});
    await prisma.atividade_colaboradores.deleteMany({});
    await prisma.lancamentos_de_horas.deleteMany({});
    await prisma.despesas.deleteMany({});
    await prisma.atividades.deleteMany({});
    await prisma.projeto_colaboradores.deleteMany({});
    await prisma.projetos.deleteMany({});
    await prisma.colaboradores.deleteMany({});
    await prisma.clientes.deleteMany({});

    // Inserir clientes
    console.log("\n📋 Criando clientes...");
    const clientesData = await Promise.all(
      mockData.clientes.map((cliente) =>
        prisma.clientes.create({
          data: cliente,
        })
      )
    );
    console.log(`✅ ${clientesData.length} clientes criados`);

    // Inserir colaboradores
    console.log("\n👥 Criando colaboradores...");
    const colaboradoresData = await Promise.all(
      mockData.colaboradores.map((colaborador) =>
        prisma.colaboradores.create({
          data: {
            nome_colaborador: colaborador.nome_colaborador,
            cargo: colaborador.cargo,
            email: colaborador.email,
            status: colaborador.status,
            data_admissao: new Date(),
          },
        })
      )
    );
    console.log(`✅ ${colaboradoresData.length} colaboradores criados`);

    // Inserir projetos
    console.log("\n📁 Criando projetos...");
    const projetosData = await Promise.all(
      mockData.projetos.map((projeto) =>
        prisma.projetos.create({
          data: {
            nome_projeto: projeto.nome_projeto,
            descricao: projeto.descricao,
            status: projeto.status,
            horas_previstas: projeto.horas_previstas,
            cliente_id: clientesData[projeto.cliente_id - 1].cliente_id,
            data_inicio: new Date(),
            data_fim: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +90 dias
          },
        })
      )
    );
    console.log(`✅ ${projetosData.length} projetos criados`);

    // Associar colaboradores aos projetos
    console.log("\n🔗 Associando colaboradores aos projetos...");
    const associacoes = [
      { projetoIdx: 0, colaboradorIdx: [0, 1, 2] },
      { projetoIdx: 1, colaboradorIdx: [1, 3, 6] },
      { projetoIdx: 2, colaboradorIdx: [2, 4, 7] },
      { projetoIdx: 3, colaboradorIdx: [5, 8] },
      { projetoIdx: 4, colaboradorIdx: [0, 5, 9] },
    ];

    for (const assoc of associacoes) {
      for (const colabIdx of assoc.colaboradorIdx) {
        if (projetosData[assoc.projetoIdx] && colaboradoresData[colabIdx]) {
          await prisma.projeto_colaboradores.create({
            data: {
              projeto_id: projetosData[assoc.projetoIdx].projeto_id,
              colaborador_id: colaboradoresData[colabIdx].colaborador_id,
            },
          });
        }
      }
    }
    console.log(`✅ Colaboradores associados aos projetos`);

    // Inserir usuários
    console.log("\n🔐 Criando usuários...");
    const usuariosData = [];

    for (let i = 0; i < mockData.usuarios.length; i++) {
      const usuario = mockData.usuarios[i];
      if (colaboradoresData[i]) {
        const usuarioCriado = await prisma.usuarios.create({
          data: {
            nome_usuario: usuario.nome_usuario,
            nome_completo: usuario.nome_completo,
            email: usuario.email,
            cargo: usuario.cargo,
            hash_senha: usuario.hash_senha,
            status: usuario.status,
            colaborador_id: colaboradoresData[i].colaborador_id,
          },
        });
        usuariosData.push(usuarioCriado);
      }
    }
    console.log(`✅ ${usuariosData.length} usuários criados`);

    console.log("\n✨ Seed concluído com sucesso!");
    console.log("\n📊 Resumo:");
    console.log(`   • Clientes: ${clientesData.length}`);
    console.log(`   • Colaboradores: ${colaboradoresData.length}`);
    console.log(`   • Projetos: ${projetosData.length}`);
    console.log(`   • Usuários: ${usuariosData.length}`);
  } catch (error) {
    console.error("❌ Erro ao fazer seed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

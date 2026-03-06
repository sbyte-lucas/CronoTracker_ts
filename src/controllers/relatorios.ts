import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Prisma } from '@/generated/prisma/client';
// import { Prisma } from './generated/prisma/client';

interface RelatoriosQuery {
  data_inicio?: string;
  data_fim?: string;
  colaborador_id?: string;
  projeto_id?: string;
  atividade_id?: string;
  exportar?: string;
  formato?: string;
}

interface DespesasQuery {
  data_inicio?: string;
  data_fim?: string;
  projeto_id?: string;
  exportar?: string;
  formato?: string;
}

export const getRelatorios = async (
  req: request,
  res: response 
): Promise<void> => {
  try {
    const { data_inicio, data_fim, colaborador_id, projeto_id, atividade_id, exportar, formato } = req.query;

    let whereClause: Prisma.lancamentos_de_horasWhereInput = {};

    // Filtro de Datas
    if (data_inicio || data_fim) {
      whereClause.data_lancamento = {};
      if (data_inicio) whereClause.data_lancamento.gte = new Date(`${data_inicio}T00:00:00.000Z`);
      if (data_fim) whereClause.data_lancamento.lte = new Date(`${data_fim}T23:59:59.999Z`);
    }

    if (colaborador_id) {
      const idNum = parseInt(colaborador_id as string);
      if (!isNaN(idNum) && idNum > 0) {
        whereClause.colaborador_id = idNum;
      }
    }

    // Filtro de Projeto
    if (projeto_id && projeto_id !== "") {
      const idProj = parseInt(projeto_id as string);
      if (!isNaN(idProj)) whereClause.projeto_id = idProj;
    }

    if (atividade_id) whereClause.atividade_id = parseInt(atividade_id as string);

    // Execução da Busca Única
    const dados = await global.prisma.lancamentos_de_horas.findMany({
      where: whereClause,
      include: {
        colaboradores: { select: { nome_colaborador: true } },
        projetos: { select: { nome_projeto: true } },
        clientes: { select: { nome_cliente: true } },
        atividades: { select: { nome_atividade: true } }
      },
      orderBy: { data_lancamento: "asc" }
    });

    // Lógica de Resposta
    if (exportar === 'true') {
      if (formato === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relatório de Horas');

        worksheet.columns = [
          { header: 'Data', key: 'data', width: 15 },
          { header: 'Colaborador', key: 'colab', width: 25 },
          { header: 'Projeto', key: 'proj', width: 25 },
          { header: 'Atividade', key: 'ativ', width: 25 },
          { header: 'Horas', key: 'horas', width: 10 },
          { header: 'Descrição', key: 'desc', width: 40 }
        ];

        dados.forEach(item => {
          worksheet.addRow({
            data: item.data_lancamento ? item.data_lancamento.toLocaleDateString('pt-BR') : '',
            colab: item.colaboradores?.nome_colaborador || '',
            proj: item.projetos?.nome_projeto || '',
            ativ: item.atividades?.nome_atividade || '',
            horas: Number(item.duracao_total) || 0,
            desc: item.descricao || ''
          });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getColumn('horas').numFmt = '0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_horas.xlsx');

        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      // CSV export
      const instrucaoExcel = "sep=;\n";
      const cabecalho = "Data;Colaborador;Cliente;Projeto;Atividade;Horas;Descricao\n";

      const limparTexto = (texto: string | null | undefined): string =>
        texto ? `"${texto.toString().replace(/"/g, '""').replace(/;/g, ',')}"` : '""';

      const csv = dados.map(item => {
        const dataFormatada = item.data_lancamento ? item.data_lancamento.toISOString().split('T')[0] : "";
        const horas = item.duracao_total ? item.duracao_total.toFixed(2).replace('.', ',') : "0,00";

        return `${dataFormatada};` +
          `"${item.colaboradores?.nome_colaborador || ''}";` +
          `"${item.clientes?.nome_cliente || ''}";` +
          `"${item.projetos?.nome_projeto || ''}";` +
          `"${item.atividades?.nome_atividade || ''}";` +
          `${horas};` +
          `${limparTexto(item.descricao)}`;
      }).join("\n");

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio_horas.csv');
      res.status(200).send("\ufeff" + instrucaoExcel + cabecalho + csv);
      return;
    }

    res.json(dados);
  } catch (error) {
    res.status(500).json({ error: "Erro ao gerar relatório" });
  }
};

export const getRelatoriosDespesas = async (
  req: Request<{}, {}, {}, DespesasQuery>,
  res: Response
): Promise<void> => {
  try {
    const { data_inicio, data_fim, projeto_id, exportar, formato } = req.query;

    let whereClause: Prisma.despesasWhereInput = {
      status_aprovacao: 'Aprovada'
    };

    if (data_inicio || data_fim) {
      whereClause.data_despesa = {};
      if (data_inicio) whereClause.data_despesa.gte = new Date(`${data_inicio}T00:00:00Z`);
      if (data_fim) whereClause.data_despesa.lte = new Date(`${data_fim}T23:59:59Z`);
    }

    // Filtro de Projeto
    if (projeto_id && projeto_id !== "") {
      const id = parseInt(projeto_id);
      if (!isNaN(id)) whereClause.projeto_id = id;
    }

    const despesas = await global.prisma.despesas.findMany({
      where: whereClause,
      include: {
        projeto: { select: { nome_projeto: true } }
      },
      orderBy: { data_despesa: 'asc' }
    });

    if (exportar === 'true') {
      if (formato === 'xlsx') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Despesas Aprovadas');

        worksheet.columns = [
          { header: 'Data', key: 'data', width: 15 },
          { header: 'Projeto', key: 'projeto', width: 30 },
          { header: 'Tipo', key: 'tipo', width: 20 },
          { header: 'Descrição', key: 'desc', width: 40 },
          { header: 'Valor (R$)', key: 'valor', width: 15 },
        ];

        despesas.forEach(d => {
          worksheet.addRow({
            data: d.data_despesa ? d.data_despesa.toLocaleDateString('pt-BR') : '',
            projeto: d.projeto?.nome_projeto || '',
            tipo: d.tipo_despesa || '',
            desc: d.descricao || '',
            valor: Number(d.valor)
          });
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.getColumn('valor').numFmt = '"R$ "#,##0.00';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=relatorio_despesas.xlsx');

        await workbook.xlsx.write(res);
        res.end();
        return;
      }

      // CSV export
      const cabecalho = "Data;Projeto;Tipo;Descricao;Valor\n";
      const csv = despesas.map(d => {
        const data = d.data_despesa ? d.data_despesa.toISOString().split('T')[0] : "";
        const valor = d.valor ? Number(d.valor).toFixed(2).replace('.', ',') : "0,00";
        const desc = d.descricao ? `"${d.descricao.replace(/"/g, '""')}"` : "";
        return `${data};"${d.projeto?.nome_projeto || ''}";"${d.tipo_despesa || ''}";${desc};${valor}`;
      }).join("\n");

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=relatorio_despesas.csv');
      res.status(200).send("\ufeff" + cabecalho + csv);
      return;
    }

    res.json(despesas.map(d => ({
      data: d.data_despesa,
      tipo_gasto: d.tipo_despesa || "Geral",
      descricao: d.descricao || "Sem descrição",
      valor: Number(d.valor) || 0,
      projeto: d.projeto?.nome_projeto || "Sem projeto"
    })));
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar despesas" });
  }
};

export default { getRelatorios, getRelatoriosDespesas };

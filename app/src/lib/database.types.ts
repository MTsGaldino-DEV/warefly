export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ajuste_itens: {
        Row: {
          ajuste_id: string
          diferenca: number | null
          id: string
          material_id: string
          qtd_contada: number
          saldo_sistema: number
        }
        Insert: {
          ajuste_id: string
          diferenca?: number | null
          id?: string
          material_id: string
          qtd_contada: number
          saldo_sistema: number
        }
        Update: {
          ajuste_id?: string
          diferenca?: number | null
          id?: string
          material_id?: string
          qtd_contada?: number
          saldo_sistema?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajuste_itens_ajuste_id_fkey"
            columns: ["ajuste_id"]
            isOneToOne: false
            referencedRelation: "ajustes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajuste_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      ajustes: {
        Row: {
          almox_id: string
          data_ocorrencia: string
          id: string
          justificativa: string
          numero: number
          registrado_em: string
          registrado_por: string
          tipo: Database["public"]["Enums"]["tipo_ajuste"]
        }
        Insert: {
          almox_id: string
          data_ocorrencia: string
          id?: string
          justificativa: string
          numero?: never
          registrado_em?: string
          registrado_por: string
          tipo: Database["public"]["Enums"]["tipo_ajuste"]
        }
        Update: {
          almox_id?: string
          data_ocorrencia?: string
          id?: string
          justificativa?: string
          numero?: never
          registrado_em?: string
          registrado_por?: string
          tipo?: Database["public"]["Enums"]["tipo_ajuste"]
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      almoxarifados: {
        Row: {
          ativo: boolean
          cidade: string | null
          codigo: string
          id: string
          nome: string
          pai_id: string | null
          tipo: Database["public"]["Enums"]["tipo_almox"]
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          codigo: string
          id?: string
          nome: string
          pai_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_almox"]
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          codigo?: string
          id?: string
          nome?: string
          pai_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_almox"]
        }
        Relationships: [
          {
            foreignKeyName: "almoxarifados_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
        ]
      }
      atribuicoes: {
        Row: {
          almox_id: string
          desde: string
          funcao: Database["public"]["Enums"]["funcao_atribuicao"]
          usuario_id: string
        }
        Insert: {
          almox_id: string
          desde?: string
          funcao: Database["public"]["Enums"]["funcao_atribuicao"]
          usuario_id: string
        }
        Update: {
          almox_id?: string
          desde?: string
          funcao?: Database["public"]["Enums"]["funcao_atribuicao"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      divergencia_tratamentos: {
        Row: {
          data_ocorrencia: string
          id: string
          justificativa: string
          quantidade: number
          remessa_gerada_id: string | null
          remessa_item_id: string
          tipo: Database["public"]["Enums"]["tipo_tratamento"]
          tratado_em: string
          tratado_por: string
        }
        Insert: {
          data_ocorrencia: string
          id?: string
          justificativa: string
          quantidade: number
          remessa_gerada_id?: string | null
          remessa_item_id: string
          tipo: Database["public"]["Enums"]["tipo_tratamento"]
          tratado_em?: string
          tratado_por: string
        }
        Update: {
          data_ocorrencia?: string
          id?: string
          justificativa?: string
          quantidade?: number
          remessa_gerada_id?: string | null
          remessa_item_id?: string
          tipo?: Database["public"]["Enums"]["tipo_tratamento"]
          tratado_em?: string
          tratado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "divergencia_tratamentos_remessa_gerada_id_fkey"
            columns: ["remessa_gerada_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_remessa_gerada_id_fkey"
            columns: ["remessa_gerada_id"]
            isOneToOne: false
            referencedRelation: "v_divergencias_abertas"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_remessa_gerada_id_fkey"
            columns: ["remessa_gerada_id"]
            isOneToOne: false
            referencedRelation: "v_em_transito"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_remessa_gerada_id_fkey"
            columns: ["remessa_gerada_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_remessa_item_id_fkey"
            columns: ["remessa_item_id"]
            isOneToOne: false
            referencedRelation: "remessa_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_remessa_item_id_fkey"
            columns: ["remessa_item_id"]
            isOneToOne: false
            referencedRelation: "v_divergencias_abertas"
            referencedColumns: ["remessa_item_id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_remessa_item_id_fkey"
            columns: ["remessa_item_id"]
            isOneToOne: false
            referencedRelation: "v_em_transito"
            referencedColumns: ["remessa_item_id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divergencia_tratamentos_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_locais: {
        Row: {
          almox_id: string
          equipe_id: string
          liberado_em: string
          liberado_por: string | null
        }
        Insert: {
          almox_id: string
          equipe_id: string
          liberado_em?: string
          liberado_por?: string | null
        }
        Update: {
          almox_id?: string
          equipe_id?: string
          liberado_em?: string
          liberado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipe_locais_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_locais_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_locais_liberado_por_fkey"
            columns: ["liberado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_locais_liberado_por_fkey"
            columns: ["liberado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativa: boolean
          codigo_zeus: number | null
          criado_em: string
          criado_por: string | null
          frota: string | null
          grupo_id: string | null
          id: string
          integrantes: string | null
          nome: string
        }
        Insert: {
          ativa?: boolean
          codigo_zeus?: number | null
          criado_em?: string
          criado_por?: string | null
          frota?: string | null
          grupo_id?: string | null
          id?: string
          integrantes?: string | null
          nome: string
        }
        Update: {
          ativa?: boolean
          codigo_zeus?: number | null
          criado_em?: string
          criado_por?: string | null
          frota?: string | null
          grupo_id?: string | null
          id?: string
          integrantes?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_locais: {
        Row: {
          almox_id: string
          grupo_id: string
        }
        Insert: {
          almox_id: string
          grupo_id: string
        }
        Update: {
          almox_id?: string
          grupo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_locais_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_locais_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          ativo: boolean
          chave_planilha: string | null
          criado_em: string
          id: string
          nome: string
          tipo_equipe: Database["public"]["Enums"]["tipo_equipe"]
        }
        Insert: {
          ativo?: boolean
          chave_planilha?: string | null
          criado_em?: string
          id?: string
          nome: string
          tipo_equipe?: Database["public"]["Enums"]["tipo_equipe"]
        }
        Update: {
          ativo?: boolean
          chave_planilha?: string | null
          criado_em?: string
          id?: string
          nome?: string
          tipo_equipe?: Database["public"]["Enums"]["tipo_equipe"]
        }
        Relationships: []
      }
      materiais: {
        Row: {
          ativo: boolean
          codigo_sap: string
          descricao: string
          grupo: string | null
          id: string
          preco: number | null
          unidade: string
        }
        Insert: {
          ativo?: boolean
          codigo_sap: string
          descricao: string
          grupo?: string | null
          id?: string
          preco?: number | null
          unidade: string
        }
        Update: {
          ativo?: boolean
          codigo_sap?: string
          descricao?: string
          grupo?: string | null
          id?: string
          preco?: number | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_unidade_fkey"
            columns: ["unidade"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
        ]
      }
      motivos_reducao: {
        Row: {
          ativo: boolean
          descricao: string
          exige_texto: boolean
          id: number
          ordem: number
        }
        Insert: {
          ativo?: boolean
          descricao: string
          exige_texto?: boolean
          id?: never
          ordem?: number
        }
        Update: {
          ativo?: boolean
          descricao?: string
          exige_texto?: boolean
          id?: never
          ordem?: number
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          ajuste_id: string | null
          almox_id: string
          criado_em: string
          criado_por: string
          data_ocorrencia: string
          id: number
          material_id: string
          quantidade: number
          remessa_id: string | null
          saida_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          tratamento_id: string | null
        }
        Insert: {
          ajuste_id?: string | null
          almox_id: string
          criado_em?: string
          criado_por: string
          data_ocorrencia: string
          id?: never
          material_id: string
          quantidade: number
          remessa_id?: string | null
          saida_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          tratamento_id?: string | null
        }
        Update: {
          ajuste_id?: string | null
          almox_id?: string
          criado_em?: string
          criado_por?: string
          data_ocorrencia?: string
          id?: never
          material_id?: string
          quantidade?: number
          remessa_id?: string | null
          saida_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimentacao"]
          tratamento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_ajuste_id_fkey"
            columns: ["ajuste_id"]
            isOneToOne: false
            referencedRelation: "ajustes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "v_divergencias_abertas"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "movimentacoes_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "v_em_transito"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "movimentacoes_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "movimentacoes_saida_id_fkey"
            columns: ["saida_id"]
            isOneToOne: false
            referencedRelation: "saidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_tratamento_id_fkey"
            columns: ["tratamento_id"]
            isOneToOne: false
            referencedRelation: "divergencia_tratamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          id: string
          material_id: string
          motivo_corte: string | null
          pedido_id: string
          qtd_aprovada: number | null
          qtd_solicitada: number
        }
        Insert: {
          id?: string
          material_id: string
          motivo_corte?: string | null
          pedido_id: string
          qtd_aprovada?: number | null
          qtd_solicitada: number
        }
        Update: {
          id?: string
          material_id?: string
          motivo_corte?: string | null
          pedido_id?: string
          qtd_aprovada?: number | null
          qtd_solicitada?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      pedidos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          atendente_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          criado_em: string
          criado_por: string
          encerrado_em: string | null
          externo: boolean
          id: string
          motivo_cancelamento: string | null
          numero: number
          observacao: string | null
          solicitado_em: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["status_pedido"]
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atendente_id: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          criado_por?: string
          encerrado_em?: string | null
          externo?: boolean
          id?: string
          motivo_cancelamento?: string | null
          numero?: never
          observacao?: string | null
          solicitado_em?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["status_pedido"]
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atendente_id?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          criado_em?: string
          criado_por?: string
          encerrado_em?: string | null
          externo?: boolean
          id?: string
          motivo_cancelamento?: string | null
          numero?: never
          observacao?: string | null
          solicitado_em?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["status_pedido"]
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          email: string | null
          id: string
          matricula: string | null
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
        }
        Insert: {
          ativo?: boolean
          email?: string | null
          id: string
          matricula?: string | null
          nome: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Update: {
          ativo?: boolean
          email?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Relationships: []
      }
      remessa_itens: {
        Row: {
          id: string
          material_id: string
          motivo_divergencia:
            | Database["public"]["Enums"]["motivo_divergencia"]
            | null
          observacao: string | null
          qtd_enviada: number
          qtd_recebida: number | null
          remessa_id: string
        }
        Insert: {
          id?: string
          material_id: string
          motivo_divergencia?:
            | Database["public"]["Enums"]["motivo_divergencia"]
            | null
          observacao?: string | null
          qtd_enviada: number
          qtd_recebida?: number | null
          remessa_id: string
        }
        Update: {
          id?: string
          material_id?: string
          motivo_divergencia?:
            | Database["public"]["Enums"]["motivo_divergencia"]
            | null
          observacao?: string | null
          qtd_enviada?: number
          qtd_recebida?: number | null
          remessa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remessa_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "v_divergencias_abertas"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "v_em_transito"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "remessa_itens_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["remessa_id"]
          },
        ]
      }
      remessas: {
        Row: {
          conferido_por_nome: string | null
          data_envio: string
          data_recebimento: string | null
          destino_id: string
          documento_ref: string | null
          encerrada_em: string | null
          enviado_em: string
          enviado_por: string
          foto_path: string | null
          id: string
          numero: number
          observacao: string | null
          origem_id: string
          pedido_id: string | null
          recebido_registrado_em: string | null
          recebido_registrado_por: string | null
          remessa_ref_id: string | null
          status: Database["public"]["Enums"]["status_remessa"]
          tipo: Database["public"]["Enums"]["tipo_remessa"]
        }
        Insert: {
          conferido_por_nome?: string | null
          data_envio: string
          data_recebimento?: string | null
          destino_id: string
          documento_ref?: string | null
          encerrada_em?: string | null
          enviado_em?: string
          enviado_por: string
          foto_path?: string | null
          id?: string
          numero?: never
          observacao?: string | null
          origem_id: string
          pedido_id?: string | null
          recebido_registrado_em?: string | null
          recebido_registrado_por?: string | null
          remessa_ref_id?: string | null
          status?: Database["public"]["Enums"]["status_remessa"]
          tipo: Database["public"]["Enums"]["tipo_remessa"]
        }
        Update: {
          conferido_por_nome?: string | null
          data_envio?: string
          data_recebimento?: string | null
          destino_id?: string
          documento_ref?: string | null
          encerrada_em?: string | null
          enviado_em?: string
          enviado_por?: string
          foto_path?: string | null
          id?: string
          numero?: never
          observacao?: string | null
          origem_id?: string
          pedido_id?: string | null
          recebido_registrado_em?: string | null
          recebido_registrado_por?: string | null
          remessa_ref_id?: string | null
          status?: Database["public"]["Enums"]["status_remessa"]
          tipo?: Database["public"]["Enums"]["tipo_remessa"]
        }
        Relationships: [
          {
            foreignKeyName: "remessas_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "remessas_recebido_registrado_por_fkey"
            columns: ["recebido_registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_recebido_registrado_por_fkey"
            columns: ["recebido_registrado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_remessa_ref_id_fkey"
            columns: ["remessa_ref_id"]
            isOneToOne: false
            referencedRelation: "remessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_remessa_ref_id_fkey"
            columns: ["remessa_ref_id"]
            isOneToOne: false
            referencedRelation: "v_divergencias_abertas"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "remessas_remessa_ref_id_fkey"
            columns: ["remessa_ref_id"]
            isOneToOne: false
            referencedRelation: "v_em_transito"
            referencedColumns: ["remessa_id"]
          },
          {
            foreignKeyName: "remessas_remessa_ref_id_fkey"
            columns: ["remessa_ref_id"]
            isOneToOne: false
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["remessa_id"]
          },
        ]
      }
      saida_itens: {
        Row: {
          id: string
          material_id: string
          quantidade: number
          saida_id: string
        }
        Insert: {
          id?: string
          material_id: string
          quantidade: number
          saida_id: string
        }
        Update: {
          id?: string
          material_id?: string
          quantidade?: number
          saida_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saida_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saida_itens_saida_id_fkey"
            columns: ["saida_id"]
            isOneToOne: false
            referencedRelation: "saidas"
            referencedColumns: ["id"]
          },
        ]
      }
      saidas: {
        Row: {
          almox_id: string
          data_ocorrencia: string
          equipe_id: string | null
          id: string
          justificativa: string | null
          motivo: Database["public"]["Enums"]["motivo_saida"]
          numero: number
          observacao: string | null
          registrado_em: string
          registrado_por: string
          retirado_por_nome: string | null
        }
        Insert: {
          almox_id: string
          data_ocorrencia: string
          equipe_id?: string | null
          id?: string
          justificativa?: string | null
          motivo?: Database["public"]["Enums"]["motivo_saida"]
          numero?: never
          observacao?: string | null
          registrado_em?: string
          registrado_por: string
          retirado_por_nome?: string | null
        }
        Update: {
          almox_id?: string
          data_ocorrencia?: string
          equipe_id?: string | null
          id?: string
          justificativa?: string | null
          motivo?: Database["public"]["Enums"]["motivo_saida"]
          numero?: never
          observacao?: string | null
          registrado_em?: string
          registrado_por?: string
          retirado_por_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saidas_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saidas_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saidas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saidas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "v_usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          aceita_fracao: boolean
          codigo: string
          descricao: string | null
          sigla_sap: string | null
        }
        Insert: {
          aceita_fracao?: boolean
          codigo: string
          descricao?: string | null
          sigla_sap?: string | null
        }
        Update: {
          aceita_fracao?: boolean
          codigo?: string
          descricao?: string | null
          sigla_sap?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_divergencias_abertas: {
        Row: {
          codigo_sap: string | null
          data_envio: string | null
          data_recebimento: string | null
          descricao: string | null
          destino_codigo: string | null
          destino_id: string | null
          destino_nome: string | null
          dias_em_aberto: number | null
          diferenca: number | null
          material_id: string | null
          motivo_divergencia:
            | Database["public"]["Enums"]["motivo_divergencia"]
            | null
          origem_codigo: string | null
          origem_id: string | null
          origem_nome: string | null
          pedido_id: string | null
          qtd_em_aberto: number | null
          qtd_enviada: number | null
          qtd_recebida: number | null
          qtd_tratada: number | null
          remessa_id: string | null
          remessa_item_id: string | null
          remessa_numero: number | null
          remessa_status: Database["public"]["Enums"]["status_remessa"] | null
          remessa_tipo: Database["public"]["Enums"]["tipo_remessa"] | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiais_unidade_fkey"
            columns: ["unidade"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "remessa_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      v_em_transito: {
        Row: {
          codigo_sap: string | null
          data_envio: string | null
          descricao: string | null
          destino_codigo: string | null
          destino_id: string | null
          destino_nome: string | null
          dias_em_transito: number | null
          enviado_em: string | null
          material_id: string | null
          origem_codigo: string | null
          origem_id: string | null
          origem_nome: string | null
          pedido_id: string | null
          qtd_enviada: number | null
          remessa_id: string | null
          remessa_item_id: string | null
          remessa_numero: number | null
          tipo: Database["public"]["Enums"]["tipo_remessa"] | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiais_unidade_fkey"
            columns: ["unidade"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "remessa_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_destino_id_fkey"
            columns: ["destino_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remessas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "v_pedido_resumo"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      v_pedido_resumo: {
        Row: {
          atendente_codigo: string | null
          atendente_id: string | null
          atendente_nome: string | null
          codigo_sap: string | null
          descricao: string | null
          diferenca_atendimento: number | null
          diferenca_conferencia: number | null
          externo: boolean | null
          material_id: string | null
          motivo_corte: string | null
          motivo_divergencia:
            | Database["public"]["Enums"]["motivo_divergencia"]
            | null
          pedido_id: string | null
          pedido_numero: number | null
          pedido_status: Database["public"]["Enums"]["status_pedido"] | null
          qtd_aprovada: number | null
          qtd_enviada: number | null
          qtd_recebida: number | null
          qtd_solicitada: number | null
          remessa_id: string | null
          remessa_numero: number | null
          remessa_status: Database["public"]["Enums"]["status_remessa"] | null
          solicitante_codigo: string | null
          solicitante_id: string | null
          solicitante_nome: string | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiais_unidade_fkey"
            columns: ["unidade"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "pedidos_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
        ]
      }
      v_saldo: {
        Row: {
          almox_codigo: string | null
          almox_id: string | null
          almox_nome: string | null
          codigo_sap: string | null
          descricao: string | null
          grupo: string | null
          material_id: string | null
          saldo: number | null
          ultima_movimentacao: string | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materiais_unidade_fkey"
            columns: ["unidade"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "movimentacoes_almox_id_fkey"
            columns: ["almox_id"]
            isOneToOne: false
            referencedRelation: "almoxarifados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      v_usuarios: {
        Row: {
          ativo: boolean | null
          id: string | null
          nome: string | null
        }
        Insert: {
          ativo?: boolean | null
          id?: string | null
          nome?: string | null
        }
        Update: {
          ativo?: boolean | null
          id?: string | null
          nome?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_consumo: {
        Args: { p_ate: string; p_de: string }
        Returns: {
          almox_codigo: string
          almox_id: string
          almox_nome: string
          codigo_sap: string
          descricao: string
          material_id: string
          quantidade: number
          unidade: string
          valor: number
        }[]
      }
      fn_destinos_transferencia: {
        Args: { p_origem_id: string }
        Returns: {
          ativo: boolean
          cidade: string | null
          codigo: string
          id: string
          nome: string
          pai_id: string | null
          tipo: Database["public"]["Enums"]["tipo_almox"]
        }[]
        SetofOptions: {
          from: "*"
          to: "almoxarifados"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_eh_admin: { Args: never; Returns: boolean }
      fn_eh_gestao: { Args: never; Returns: boolean }
      fn_eh_gestora: { Args: never; Returns: boolean }
      fn_eh_responsavel: { Args: { p_almox_id: string }; Returns: boolean }
      fn_gere_local: { Args: { p_almox_id: string }; Returns: boolean }
      fn_hoje: { Args: never; Returns: string }
      fn_indicadores: {
        Args: { p_ate: string; p_de: string }
        Returns: {
          ajustes_qtd: number
          ajustes_valor_abs: number
          almox_codigo: string
          almox_id: string
          almox_nome: string
          almox_tipo: Database["public"]["Enums"]["tipo_almox"]
          indice_divergencia: number
          perda_transito_qtd: number
          perda_transito_valor: number
          qtd_enviada: number
          qtd_solicitada: number
          remessas_com_divergencia: number
          remessas_recebidas: number
          saidas_valor: number
          taxa_atendimento: number
          tempo_transito_medio: number
        }[]
      }
      fn_pode_ver: { Args: { p_almox_id: string }; Returns: boolean }
      fn_pode_ver_equipe: { Args: { p_equipe_id: string }; Returns: boolean }
      fn_pode_ver_foto: { Args: { p_nome: string }; Returns: boolean }
      fn_pode_ver_remessa: { Args: { p_remessa_id: string }; Returns: boolean }
      rpc_aprovar_pedido: {
        Args: { p_itens: Json; p_pedido_id: string }
        Returns: undefined
      }
      rpc_ativar_equipe: {
        Args: { p_ativa: boolean; p_equipe_id: string }
        Returns: undefined
      }
      rpc_cancelar_pedido: {
        Args: { p_motivo: string; p_pedido_id: string }
        Returns: undefined
      }
      rpc_criar_remessa_avulsa: {
        Args: {
          p_data_envio?: string
          p_destino_id: string
          p_documento_ref?: string
          p_id?: string
          p_itens: Json
          p_observacao?: string
          p_origem_id: string
          p_tipo: Database["public"]["Enums"]["tipo_remessa"]
        }
        Returns: string
      }
      rpc_definir_locais_equipe: {
        Args: { p_equipe_id: string; p_locais: string[] }
        Returns: undefined
      }
      rpc_enviar_pedido: { Args: { p_pedido_id: string }; Returns: undefined }
      rpc_enviar_remessa_pedido: {
        Args: {
          p_data_envio?: string
          p_documento_ref?: string
          p_itens: Json
          p_observacao?: string
          p_pedido_id: string
        }
        Returns: string
      }
      rpc_importar_equipes: {
        Args: { p_linhas: Json; p_simular?: boolean }
        Returns: Json
      }
      rpc_registrar_ajuste: {
        Args: {
          p_almox_id: string
          p_data_ocorrencia?: string
          p_id?: string
          p_itens: Json
          p_justificativa: string
          p_tipo: Database["public"]["Enums"]["tipo_ajuste"]
        }
        Returns: string
      }
      rpc_registrar_recebimento: {
        Args: {
          p_conferido_por_nome: string
          p_data_recebimento: string
          p_foto_path: string
          p_itens: Json
          p_remessa_id: string
        }
        Returns: Database["public"]["Enums"]["status_remessa"]
      }
      rpc_registrar_recebimento_externo: {
        Args: {
          p_conferido_por_nome: string
          p_data_envio?: string
          p_data_recebimento: string
          p_destino_id: string
          p_documento_ref: string
          p_foto_path: string
          p_itens: Json
          p_observacao?: string
          p_pedido_id?: string
          p_remessa_id: string
        }
        Returns: Database["public"]["Enums"]["status_remessa"]
      }
      rpc_registrar_saida: {
        Args: {
          p_almox_id: string
          p_data_ocorrencia?: string
          p_equipe_id?: string
          p_id?: string
          p_itens: Json
          p_justificativa?: string
          p_motivo?: Database["public"]["Enums"]["motivo_saida"]
          p_observacao?: string
          p_retirado_por_nome?: string
        }
        Returns: string
      }
      rpc_salvar_equipe: {
        Args: {
          p_ativa?: boolean
          p_codigo_zeus: number
          p_frota: string
          p_grupo_id: string
          p_id?: string
          p_integrantes: string
          p_locais?: string[]
          p_nome: string
        }
        Returns: string
      }
      rpc_salvar_grupo: {
        Args: {
          p_ativo?: boolean
          p_chave_planilha?: string
          p_id?: string
          p_locais: string[]
          p_nome: string
          p_tipo_equipe: Database["public"]["Enums"]["tipo_equipe"]
        }
        Returns: string
      }
      rpc_tratar_divergencia: {
        Args: {
          p_data_ocorrencia?: string
          p_justificativa: string
          p_quantidade: number
          p_remessa_item_id: string
          p_tipo: Database["public"]["Enums"]["tipo_tratamento"]
        }
        Returns: string
      }
    }
    Enums: {
      funcao_atribuicao: "responsavel" | "supervisor"
      motivo_divergencia: "falta" | "sobra" | "avaria" | "trocado"
      motivo_saida: "aplicacao" | "perda" | "avaria"
      papel_usuario: "admin" | "gestao" | "operador"
      status_pedido:
        | "rascunho"
        | "solicitado"
        | "aprovado"
        | "em_transito"
        | "com_divergencia"
        | "encerrado"
        | "cancelado"
      status_remessa: "em_transito" | "com_divergencia" | "encerrada"
      tipo_ajuste: "implantacao" | "inventario"
      tipo_almox: "externo" | "regional" | "base"
      tipo_equipe: "multifuncional" | "moto"
      tipo_movimentacao:
        | "saldo_inicial"
        | "envio_remessa"
        | "recebimento_remessa"
        | "saida"
        | "ajuste_inventario"
        | "ajuste_divergencia"
      tipo_remessa:
        | "atendimento"
        | "externa"
        | "transferencia"
        | "devolucao"
        | "reenvio"
      tipo_tratamento:
        | "reenvio"
        | "chegou_depois"
        | "baixa_transito"
        | "ajuste_origem"
        | "externo"
        | "erro_contagem"
        | "estorno_origem"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      funcao_atribuicao: ["responsavel", "supervisor"],
      motivo_divergencia: ["falta", "sobra", "avaria", "trocado"],
      motivo_saida: ["aplicacao", "perda", "avaria"],
      papel_usuario: ["admin", "gestao", "operador"],
      status_pedido: [
        "rascunho",
        "solicitado",
        "aprovado",
        "em_transito",
        "com_divergencia",
        "encerrado",
        "cancelado",
      ],
      status_remessa: ["em_transito", "com_divergencia", "encerrada"],
      tipo_ajuste: ["implantacao", "inventario"],
      tipo_almox: ["externo", "regional", "base"],
      tipo_equipe: ["multifuncional", "moto"],
      tipo_movimentacao: [
        "saldo_inicial",
        "envio_remessa",
        "recebimento_remessa",
        "saida",
        "ajuste_inventario",
        "ajuste_divergencia",
      ],
      tipo_remessa: [
        "atendimento",
        "externa",
        "transferencia",
        "devolucao",
        "reenvio",
      ],
      tipo_tratamento: [
        "reenvio",
        "chegou_depois",
        "baixa_transito",
        "ajuste_origem",
        "externo",
        "erro_contagem",
        "estorno_origem",
      ],
    },
  },
} as const


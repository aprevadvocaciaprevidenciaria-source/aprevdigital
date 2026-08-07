-- Painel APREV - registra quando uma tarefa foi marcada como concluída, pra
-- dar pra montar ranking de produtividade por colaborador depois (uso
-- interno do sócio, não aparece pras secretárias). updated_at não serve pra
-- isso porque qualquer edição da tarefa (título, prioridade, etc.) também
-- mexe nele, não só a conclusão.
-- Idempotente: seguro rodar em cima do schema já existente.

alter table tarefas add column if not exists concluida_em timestamptz;

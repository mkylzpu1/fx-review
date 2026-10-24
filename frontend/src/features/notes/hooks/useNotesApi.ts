import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { toQueryString } from "@/features/trades/hooks/useTradesApi";
import { ruleKeys } from "@/features/rules/hooks/useRulesApi";
import type {
  AiName,
  NoteDetail,
  NoteFilter,
  NoteListItem,
  Page,
  RuleValidation,
} from "../types";

export const noteKeys = {
  all: ["notes"] as const,
  list: (f: NoteFilter, page: number) => ["notes", "list", f, page] as const,
  detail: (id: string) => ["notes", "detail", id] as const,
  validations: ["notes", "validations"] as const,
};

const filterQuery = (f: NoteFilter) =>
  f === "ai" || f === "self"
    ? { kind: f }
    : f === "validating"
      ? { validating: "true" }
      : {};

export function useNotes(filter: NoteFilter, page: number, limit = 10) {
  return useQuery({
    queryKey: noteKeys.list(filter, page),
    queryFn: () =>
      apiClient.get<Page<NoteListItem>>(
        `/notes${toQueryString({ ...filterQuery(filter), page, limit })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: noteKeys.detail(id ?? ""),
    queryFn: () => apiClient.get<NoteDetail>(`/notes/${id}`),
    enabled: Boolean(id),
  });
}

export function useValidations() {
  return useQuery({
    queryKey: noteKeys.validations,
    queryFn: () =>
      apiClient
        .get<{ items: RuleValidation[] }>("/notes/validations")
        .then((r) => r.items),
  });
}

export interface AiNoteBody {
  aiName: AiName;
  dataRangeLabel: string | null;
  rawResponse: string;
}

export function useCreateAiNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AiNoteBody) =>
      apiClient.post<NoteDetail>("/notes/ai", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ id: string }>(`/notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

export function useToRule(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (improvementId: string) =>
      apiClient.post<{ id: string }>(
        `/notes/${noteId}/improvements/${improvementId}/to-rule`,
        {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noteKeys.all });
      void qc.invalidateQueries({ queryKey: ruleKeys.all });
    },
  });
}

/** トレード詳細の「次回のルール」などから、自分の気づきを作る */
export function useCreateSelfNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      body?: string;
      emotionTags?: string[];
      nextRule?: string | null;
      sourceTradeId?: string | null;
    }) => apiClient.post<NoteDetail>("/notes", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

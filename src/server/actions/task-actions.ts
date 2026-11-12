"use server";

import { getServerSession } from "@/server/auth/session";
import {
  createTask,
  updateTask,
  toggleChecklistItem,
  CreateTaskInput,
  UpdateTaskInput,
} from "@/server/services/task-service";
import {
  createNote,
  updateNote,
  deleteNote,
  CreateNoteInput,
  UpdateNoteInput,
} from "@/server/services/note-service";
import { Priority, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(2, "L'intitulé de la tâche doit comporter au moins 2 caractères"),
  description: z.string().optional(),
  priority: z.nativeEnum(Priority).optional(),
  matterId: z.string().optional().nullable(),
  procedureId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  estimatedMinutes: z.number().optional().nullable(),
  requiresValidation: z.boolean().optional(),
  checklistLabels: z.array(z.string()).optional(),
});

export async function createTaskAction(rawData: z.infer<typeof createTaskSchema>) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  const parsed = createTaskSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
  }

  try {
    const task = await createTask(
      {
        ...parsed.data,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      },
      session
    );

    if (parsed.data.matterId) {
      revalidatePath(`/matters/${parsed.data.matterId}`);
    }
    return { success: true, task };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de création de tâche" };
  }
}

export async function updateTaskStatusAction(
  taskId: string,
  matterId: string,
  status: TaskStatus,
  cancelReason?: string
) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    const task = await updateTask(
      taskId,
      { status, cancelReason },
      session
    );
    revalidatePath(`/matters/${matterId}`);
    return { success: true, task };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de mise à jour" };
  }
}

export async function toggleChecklistItemAction(
  itemId: string,
  matterId: string,
  done: boolean
) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    await toggleChecklistItem(itemId, done, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createNoteAction(
  matterId: string,
  body: string,
  shareable: boolean = false
) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    const note = await createNote(
      { matterId, body, shareable },
      session
    );
    revalidatePath(`/matters/${matterId}`);
    return { success: true, note };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de création de note" };
  }
}

export async function deleteNoteAction(noteId: string, matterId: string) {
  const session = await getServerSession();
  if (!session) {
    return { success: false, error: "Non authentifié" };
  }

  try {
    await deleteNote(noteId, session);
    revalidatePath(`/matters/${matterId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de suppression" };
  }
}


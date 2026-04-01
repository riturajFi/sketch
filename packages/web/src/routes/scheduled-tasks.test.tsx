import type { ScheduledTaskListItem } from "@/lib/api";
import { server } from "@/test/msw";
import { renderWithProviders } from "@/test/utils";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScheduledTasksPage } from "./scheduled-tasks";

let mockAuth: { role: "admin" | "member"; email: string; userId?: string } = {
  role: "admin",
  email: "admin@test.com",
};

function setMockAuth(auth: Partial<typeof mockAuth>) {
  mockAuth = { ...mockAuth, ...auth };
}

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    useRouteContext: () => ({ auth: mockAuth }),
  };
});

afterEach(() => {
  mockAuth = { role: "admin", email: "admin@test.com" };
});

function buildTask(overrides: Partial<ScheduledTaskListItem> = {}): ScheduledTaskListItem {
  return {
    id: "task-1",
    platform: "slack",
    contextType: "channel",
    deliveryTarget: "C123",
    threadTs: null,
    prompt: "Post the Monday revenue summary",
    scheduleType: "cron",
    scheduleValue: "0 9 * * 1",
    timezone: "Asia/Kolkata",
    sessionMode: "fresh",
    nextRunAt: "2026-03-20T03:30:00.000Z",
    lastRunAt: "2026-03-13T03:30:00.000Z",
    status: "active",
    createdBy: "user-1",
    createdAt: "2026-03-10T09:15:00.000Z",
    targetLabel: "#ops",
    targetKindLabel: "Slack channel",
    creatorName: "Alice Member",
    scheduleLabel: "Cron: 0 9 * * 1 (Asia/Kolkata)",
    canPause: true,
    canResume: false,
    canDelete: true,
    ...overrides,
  };
}

function installTaskHandlers(initialTasks: ScheduledTaskListItem[]) {
  let tasks = [...initialTasks];

  server.use(
    http.get("/api/scheduled-tasks", () => {
      return HttpResponse.json({ tasks });
    }),
    http.post("/api/scheduled-tasks/:id/pause", ({ params }) => {
      tasks = tasks.map((task) =>
        task.id === params.id ? { ...task, status: "paused", canPause: false, canResume: true } : task,
      );
      const task = tasks.find((item) => item.id === params.id);
      return HttpResponse.json({ task });
    }),
    http.post("/api/scheduled-tasks/:id/resume", ({ params }) => {
      tasks = tasks.map((task) =>
        task.id === params.id ? { ...task, status: "active", canPause: true, canResume: false } : task,
      );
      const task = tasks.find((item) => item.id === params.id);
      return HttpResponse.json({ task });
    }),
    http.delete("/api/scheduled-tasks/:id", ({ params }) => {
      tasks = tasks.filter((task) => task.id !== params.id);
      return HttpResponse.json({ success: true });
    }),
  );
}

describe("ScheduledTasksPage", () => {
  it("shows a loading skeleton before rendering task rows", async () => {
    server.use(
      http.get("/api/scheduled-tasks", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ tasks: [buildTask()] });
      }),
    );

    renderWithProviders(<ScheduledTasksPage />);

    expect(document.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("Post the Monday revenue summary")).toBeInTheDocument();
    });
  });

  it("shows the empty state when there are no tasks", async () => {
    installTaskHandlers([]);

    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("No scheduled tasks yet")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Create a scheduled task by asking the assistant to remind you or run something on a schedule."),
    ).toBeInTheDocument();
  });

  it("renders the correct subtitle for admins and members", async () => {
    installTaskHandlers([buildTask()]);

    const { rerender } = renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("View and manage recurring and one-time tasks across the workspace")).toBeInTheDocument();
    });

    setMockAuth({ role: "member", userId: "user-1" });
    rerender(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("View and manage the tasks you created through chat")).toBeInTheDocument();
    });
  });

  it("shows creator names for admins and hides them for members", async () => {
    installTaskHandlers([
      buildTask({ creatorName: "Alice Admin" }),
      buildTask({
        id: "task-2",
        prompt: "Send a WhatsApp follow-up",
        platform: "whatsapp",
        contextType: "dm",
        deliveryTarget: "919999999999@s.whatsapp.net",
        targetLabel: "Bob User",
        targetKindLabel: "WhatsApp DM",
        creatorName: "Alice Admin",
      }),
    ]);

    const { unmount } = renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("Post the Monday revenue summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Send a WhatsApp follow-up")).toBeInTheDocument();
    expect(screen.getAllByText(/Alice Admin/)).toHaveLength(2);

    unmount();

    setMockAuth({ role: "member", userId: "user-1" });
    server.use(
      http.get("/api/scheduled-tasks", () => {
        return HttpResponse.json({
          tasks: [
            buildTask({
              id: "task-member",
              prompt: "Only my task",
              creatorName: "Alice Admin",
            }),
          ],
        });
      }),
    );

    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("Only my task")).toBeInTheDocument();
    });
    expect(screen.queryByText("Send a WhatsApp follow-up")).not.toBeInTheDocument();
    expect(screen.queryByText(/Alice Admin/)).not.toBeInTheDocument();
  });

  it("renders expanded task details for troubleshooting", async () => {
    installTaskHandlers([
      buildTask({
        deliveryTarget: "C999",
        timezone: "UTC",
      }),
    ]);

    const user = userEvent.setup();
    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("Post the Monday revenue summary")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Show details for Post the Monday revenue summary/i }));

    await waitFor(() => {
      expect(screen.getByText("Delivery target")).toBeInTheDocument();
    });
    expect(screen.getByText("C999")).toBeInTheDocument();
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByText("UTC")).toBeInTheDocument();
  });

  it("pauses an active task via the dropdown menu", async () => {
    installTaskHandlers([buildTask()]);

    const user = userEvent.setup();
    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Task actions for Post the Monday revenue summary/i }));
    await user.click(screen.getByRole("menuitem", { name: /pause/i }));

    await waitFor(() => {
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });
  }, 10000);

  it("resumes a paused task via the dropdown menu", async () => {
    installTaskHandlers([
      buildTask({
        status: "paused",
        canPause: false,
        canResume: true,
      }),
    ]);

    const user = userEvent.setup();
    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Task actions for Post the Monday revenue summary/i }));
    await user.click(screen.getByRole("menuitem", { name: /resume/i }));

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("deletes a task after confirmation via the dropdown menu", async () => {
    installTaskHandlers([buildTask()]);

    const user = userEvent.setup();
    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText("Post the Monday revenue summary")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Task actions for Post the Monday revenue summary/i }));
    await user.click(screen.getByRole("menuitem", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Delete scheduled task?")).toBeInTheDocument();
    });

    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("No scheduled tasks yet")).toBeInTheDocument();
    });
    expect(screen.queryByText("Post the Monday revenue summary")).not.toBeInTheDocument();
  });

  it("renders fallback target ids when no friendly target label is available", async () => {
    installTaskHandlers([
      buildTask({
        deliveryTarget: "unknown@g.us",
        targetLabel: "unknown@g.us",
        targetKindLabel: "WhatsApp group",
        platform: "whatsapp",
      }),
    ]);

    renderWithProviders(<ScheduledTasksPage />);

    await waitFor(() => {
      expect(screen.getByText(/unknown@g\.us/)).toBeInTheDocument();
    });
  });
});

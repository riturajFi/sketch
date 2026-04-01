import { server } from "@/test/msw";
import { renderWithProviders } from "@/test/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamPage } from "./team";

/**
 * Mutable auth context. Tests can override via setMockAuth() to switch
 * between admin and member views. Resets to admin after each test.
 */
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

describe("TeamPage", () => {
  it("renders member list", async () => {
    renderWithProviders(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Team members")).toBeInTheDocument();
  });

  it("shows empty state when no users", async () => {
    server.use(
      http.get("/api/users", () => {
        return HttpResponse.json({ users: [] });
      }),
    );
    renderWithProviders(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText("Your team's empty!")).toBeInTheDocument();
    });
  });

  it("shows loading skeleton initially", () => {
    renderWithProviders(<TeamPage />);
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  describe("Add member dialog", () => {
    it("opens when clicking Add member button", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Add member/i }));

      await waitFor(() => {
        expect(screen.getByText("Add a new team member. Name and email are required.")).toBeInTheDocument();
      });
    });

    it("disables submit when email is missing", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Add member/i }));

      await waitFor(() => {
        expect(screen.getByLabelText("Name")).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText("Name"), "Charlie");
      // No email typed

      expect(screen.getByRole("button", { name: "Add member" })).toBeDisabled();
    });

    it("creates a user on submit", async () => {
      const createFn = vi.fn();
      server.use(
        http.post("/api/users", async ({ request }) => {
          const body = (await request.json()) as { name: string; email: string | null; whatsappNumber: string | null };
          createFn(body);
          return HttpResponse.json(
            {
              user: {
                id: "u-new",
                name: body.name,
                email: body.email,
                slack_user_id: null,
                whatsapp_number: body.whatsappNumber,
                created_at: new Date().toISOString(),
              },
            },
            { status: 201 },
          );
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Add member/i }));

      await waitFor(() => {
        expect(screen.getByLabelText("Name")).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText("Name"), "Charlie");
      await user.type(screen.getByLabelText("Email"), "charlie@test.com");
      await user.type(screen.getByLabelText("WhatsApp number"), "+14155551234");
      await user.click(screen.getByRole("button", { name: "Add member" }));

      await waitFor(() => {
        expect(createFn).toHaveBeenCalledWith({
          name: "Charlie",
          type: "human",
          role: null,
          reportsTo: null,
          email: "charlie@test.com",
          whatsappNumber: "+14155551234",
          description: null,
        });
      });
    }, 10000);

    it("shows inline error on duplicate number", async () => {
      server.use(
        http.post("/api/users", () => {
          return HttpResponse.json(
            { error: { code: "CONFLICT", message: "This email or number is already linked to another member" } },
            { status: 409 },
          );
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Add member/i }));

      await waitFor(() => {
        expect(screen.getByLabelText("Name")).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText("Name"), "Dupe");
      await user.type(screen.getByLabelText("Email"), "dupe@test.com");
      await user.type(screen.getByLabelText("WhatsApp number"), "+919876543210");
      await user.click(screen.getByRole("button", { name: "Add member" }));

      await waitFor(() => {
        expect(screen.getByText("This email or number is already linked to another member")).toBeInTheDocument();
      });
    });
  });

  it("does not show 'You' badge for admin even when a member has the same email", async () => {
    server.use(
      http.get("/api/users", () => {
        return HttpResponse.json({
          users: [
            {
              id: "u1",
              name: "Alice Smith",
              email: "admin@test.com",
              slack_user_id: null,
              whatsapp_number: null,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        });
      }),
    );

    renderWithProviders(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("shows 'You' badge for the matching member when viewing as member", async () => {
    setMockAuth({ role: "member", userId: "u1" });

    renderWithProviders(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not show 'You' badge on non-matching members when viewing as member", async () => {
    setMockAuth({ role: "member", userId: "u-other" });

    renderWithProviders(<TeamPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });

    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  describe("Remove member dialog", () => {
    it("opens from overflow menu and removes on confirm", async () => {
      const removeFn = vi.fn();
      server.use(
        http.delete("/api/users/:id", () => {
          removeFn();
          return HttpResponse.json({ success: true });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<TeamPage />);

      await waitFor(() => {
        expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      });

      // Open overflow menu on a non-admin row
      const menuTriggers = screen.getAllByRole("button").filter((btn) => btn.querySelector("svg"));
      // The last overflow menu button (for one of the users)
      const overflowBtn = menuTriggers[menuTriggers.length - 1];
      await user.click(overflowBtn);

      await waitFor(() => {
        expect(screen.getByText("Remove member")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Remove member"));

      await waitFor(() => {
        expect(screen.getByText("Remove team member?")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Remove" }));

      await waitFor(() => {
        expect(removeFn).toHaveBeenCalled();
      });
    });
  });
});

# Coffee Order Tracker

A real-time coffee shop order system for cashiers, baristas, and customers, with QR-linked order tracking and ready alerts.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the ASP.NET Core API and SignalR hub
- `pnpm --filter @workspace/coffee-order-tracker run dev` — run the cashier, kitchen, and customer web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `dotnet build artifacts/api-server/dotnet/CoffeeOrderApi.csproj` — build the API
- Required runtime: .NET 8
- Order data is stored in a SQLite database created by the API on first run

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: ASP.NET Core 8 Web API + SignalR
- DB: SQLite + Entity Framework Core 8
- Web: React + Vite
- API validation: ASP.NET Core model binding plus domain validation
- API codegen: Orval (from OpenAPI spec)
- Build: .NET SDK/MSBuild for the API; Vite for the web app

## Where things live

- `artifacts/api-server/dotnet/` — HTTP API, EF Core data model, seed data, and SignalR hub
- `artifacts/coffee-order-tracker/src/` — cashier, kitchen, and customer interfaces
- `lib/api-spec/openapi.yaml` — REST API contract and source for generated client hooks

## Architecture decisions

- ASP.NET Core and the frontend share the `/api` route; SignalR connects at `/api/hubs/orders`.
- Kitchen clients join the kitchen group; customer clients join only their order-specific group.
- SQLite is initialized and seeded with a small demo queue on the first API run.
- Order prices are checked against the server menu, and status changes must follow Pending → Preparing → Ready → Completed.

## Product

- Cashiers build an order and show a QR code linking to its customer status page.
- Baristas see active orders and advance preparation status.
- Customers can follow status updates live and enable an audible ready alert.

## User preferences

_No standing preferences recorded._

## Gotchas

- Keep `/api/hubs/orders` listed in the API artifact's configured paths; the preview proxy needs the explicit WebSocket route.
- Run API code generation after changing the OpenAPI spec.
- The SQLite database file is runtime data and should remain excluded from source control and deployment uploads.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

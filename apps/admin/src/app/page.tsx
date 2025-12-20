import { Card, CardHeader, CardTitle, CardDescription, CardContent, ConnectButton } from "@tagit/ui";

export default function AdminPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">TAG IT Admin</h1>
            <p className="text-muted-foreground">Internal Dashboard</p>
          </div>
          <ConnectButton />
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Assets</CardTitle>
              <CardDescription>Manage digital twins</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Total assets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Badge holders</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Active users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flags</CardTitle>
              <CardDescription>Pending review</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Open flags</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

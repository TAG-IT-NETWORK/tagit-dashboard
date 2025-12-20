import { Card, CardHeader, CardTitle, CardDescription, CardContent, ConnectButton } from "@tagit/ui";

export default function ConsolePage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">TAG IT Console</h1>
            <p className="text-muted-foreground">B2B Portal</p>
          </div>
          <ConnectButton />
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>My Assets</CardTitle>
              <CardDescription>Digital twins you manage</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Total assets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mint</CardTitle>
              <CardDescription>Create new digital twins</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Requires MANUFACTURER badge
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Recent transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

import { Card, CardHeader, CardTitle, CardDescription, CardContent, ConnectButton, Button } from "@tagit/ui";

export default function AppPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">TAG IT</h1>
            <p className="text-muted-foreground">Authenticate Your Products</p>
          </div>
          <ConnectButton />
        </header>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Verify a Product</CardTitle>
            <CardDescription>
              Scan a TAG IT code or enter an asset ID to verify authenticity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button variant="default">Scan QR Code</Button>
              <Button variant="outline">Enter Asset ID</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>My Claims</CardTitle>
              <CardDescription>Products you own</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">--</p>
              <p className="text-sm text-muted-foreground">Claimed products</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Flags</CardTitle>
              <CardDescription>Reported issues</CardDescription>
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

import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Button } from "@tagit/ui";

export default function VerifyPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold">TAG IT Verify</h1>
          <p className="text-muted-foreground">Public Product Verification</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Verify Authenticity</CardTitle>
            <CardDescription>
              Enter an asset ID to check if a product is authentic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Enter asset ID (e.g., 1, 2, 3...)"
                type="text"
              />
              <Button className="w-full">Verify Product</Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by TAG IT Network on Optimism</p>
          <p className="mt-2">
            No wallet required to verify products
          </p>
        </div>
      </div>
    </main>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardCardProps {
  email: string | null;
}

export default function DashboardCard({ email }: DashboardCardProps) {
  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Welcome, {email}</p>
        <CardDescription className="mt-2">This page is only for authenticated users.</CardDescription>
      </CardContent>
      <CardFooter className="justify-center">
        <form method="POST" action="/api/auth/signout">
          <Button variant="default" type="submit">
            Sign out
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

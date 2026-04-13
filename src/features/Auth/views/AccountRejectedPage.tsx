import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { IconCircleX } from "@tabler/icons-react";
import { useAuth } from "@shared/context/AuthContext";

export function AccountRejectedPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login", { replace: true });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Account Not Approved</CardTitle>
                    <CardDescription>
                        Your registration was not approved
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <IconCircleX className="h-16 w-16 text-destructive" />
                    <p className="text-center text-muted-foreground">
                        Unfortunately, your account registration was not approved at this time.
                    </p>
                    {user?.rejectionReason && (
                        <div className="w-full rounded-md border border-destructive/20 bg-destructive/5 p-3">
                            <p className="text-sm font-medium text-destructive">Reason</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {user.rejectionReason}
                            </p>
                        </div>
                    )}
                    <p className="text-center text-sm text-muted-foreground">
                        If you believe this is a mistake, please contact the platform administrator.
                    </p>
                    <Button variant="outline" onClick={handleLogout} className="mt-2">
                        Log Out
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

import { useAdminAuth } from '@/hooks/useAdminAuth';
import AdminApp from '../../admin/src/App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdminDashboardWrapper() {
  const { isAdmin, isLoading, hasSession } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center" dir="rtl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground" style={{ fontFamily: "Vazirmatn, system-ui, sans-serif" }}>
            در حال بررسی دسترسی...
          </p>
        </div>
      </div>
    );
  }

  // اگر لاگین نیست، صفحه لاگین ادمین را نشان بده
  if (!hasSession) {
    return <AdminApp />;
  }

  // اگر لاگین است اما admin نیست
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full" dir="rtl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>دسترسی غیرمجاز</CardTitle>
            </div>
            <CardDescription>
              شما به این بخش دسترسی ندارید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                این صفحه فقط برای مدیران سیستم قابل دسترسی است. 
                لطفاً با حساب کاربری مدیر وارد شوید.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminApp />
  );
}

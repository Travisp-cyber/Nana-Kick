// import { headers } from "next/headers"; // Reserved for future Whop SDK usage

interface DashboardPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { companyId } = await params;

  // Get authorization header for Whop SDK
  // const headersList = await headers();
  // const authHeader = headersList.get("authorization") || ""; // Reserved for future SDK usage

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">Image Editor Dashboard</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          Configure your AI-powered image editor settings
        </p>
        
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-2xl font-semibold mb-4">App Settings</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Company ID: {companyId}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
            This dashboard will allow creators to configure settings for the image editor,
            such as usage limits, pricing, and customization options.
          </p>
        </div>
        
        <div className="text-left space-y-4">
          <h3 className="text-lg font-semibold">Coming Soon:</h3>
          <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
            <li>Set monthly usage limits for your members</li>
            <li>Configure AI model preferences</li>
            <li>Customize the editor interface</li>
            <li>View usage analytics</li>
            <li>Manage member permissions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // const headersList = await headers(); // Reserved for future webhook verification
    
    // Log webhook event (you can handle specific events here)
    console.log("Webhook received:", {
      event: body.event,
      data: body.data,
    });

    // Handle different webhook events
    switch (body.event) {
      case "app.installed":
        // Handle app installation
        console.log("App installed for company:", body.data.company_id);
        break;
        
      case "app.uninstalled":
        // Handle app uninstallation
        console.log("App uninstalled for company:", body.data.company_id);
        break;
        
      case "membership.went_valid":
        // Handle new membership
        console.log("New membership activated:", body.data.membership_id);
        break;
        
      case "membership.went_invalid":
        // Handle membership cancellation
        console.log("Membership deactivated:", body.data.membership_id);
        break;
        
      default:
        console.log("Unhandled webhook event:", body.event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 }
    );
  }
}
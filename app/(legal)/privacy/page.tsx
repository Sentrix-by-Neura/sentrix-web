import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy | Sentrix" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>This policy describes the information Sentrix uses to provide account access and equipment monitoring.</p>
      <section>
        <h2>Account and browser information</h2>
        <p>Sentrix uses your name and email address for your profile and email verification. Supabase Auth handles sign-in and email verification. Your browser stores the session to keep you signed in and saves your theme preference locally.</p>
      </section>
      <section>
        <h2>Sensor and workspace information</h2>
        <p>Sentrix records groups, device names and identifiers, timestamps, connection status and readings reported by sensors, such as current, temperature and equipment state. Sentrix uses this information to show telemetry, calculate expected ranges, and generate alerts. Feedback you submit is stored with the corresponding alert.</p>
      </section>
      <section>
        <h2>Sensor setup</h2>
        <p>During setup, the site uses the hardware PIN to verify the sensor and passes Wi-Fi credentials to the sensor over Bluetooth so it can connect to your network.</p>
      </section>
      <section>
        <h2>Managing your information</h2>
        <p>You can edit your display name in Settings and export telemetry from a sensor’s detail page. A transferred sensor may appear as archived history in its former workspace. Deleting a sensor or archived history removes the associated telemetry, predictions and alerts as described in the deletion confirmation.</p>
      </section>
      <p>See the <Link href="/terms">Terms of Service</Link> for the rules on using Sentrix.</p>
    </>
  );
}

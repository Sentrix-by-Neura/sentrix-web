import type { Metadata } from "next";
import Link from "next/link";
import { T } from "../../lib/language-context";

export const metadata: Metadata = { title: "Privacy Policy | Sentrix" };

export default function PrivacyPage() {
  return (
    <>
      <h1><T>Privacy Policy</T></h1>
      <p><T>This policy describes the information Sentrix uses to provide account access and equipment monitoring.</T></p>
      <section>
        <h2><T>Account and browser information</T></h2>
        <p><T>Sentrix uses your name and email address for your profile and email verification. Supabase Auth handles sign-in and email verification. Your browser stores the session to keep you signed in and saves your theme and language preferences locally.</T></p>
      </section>
      <section>
        <h2><T>Sensor and workspace information</T></h2>
        <p><T>Sentrix records groups, device names and identifiers, timestamps, connection status and readings reported by sensors, such as current, temperature and equipment state. Sentrix uses this information to show telemetry, calculate expected ranges, and generate alerts. Feedback you submit is stored with the corresponding alert.</T></p>
      </section>
      <section>
        <h2><T>Sensor setup</T></h2>
        <p><T>During setup, the site uses the hardware PIN to verify the sensor and passes Wi-Fi credentials to the sensor over Bluetooth so it can connect to your network.</T></p>
      </section>
      <section>
        <h2><T>Managing your information</T></h2>
        <p><T>You can edit your display name in Settings and export telemetry from a sensor’s detail page. A transferred sensor may appear as archived history in its former workspace. Deleting a sensor or archived history removes the associated telemetry, predictions and alerts as described in the deletion confirmation.</T></p>
      </section>
      <p><T>See the</T> <Link href="/terms"><T>Terms of Service</T></Link> <T>for the rules on using Sentrix.</T></p>
    </>
  );
}

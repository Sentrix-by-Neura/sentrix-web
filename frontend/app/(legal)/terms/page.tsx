import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of Service | Sentrix" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>These terms apply when you create an account or use Sentrix to monitor electrical equipment.</p>
      <section>
        <h2>Accounts and equipment</h2>
        <p>Provide accurate account information and keep your sign-in and device setup credentials private. Only connect sensors, equipment and networks that you own or have permission to monitor.</p>
      </section>
      <section>
        <h2>Using Sentrix</h2>
        <p>Use Sentrix for authorized monitoring and maintenance. Respect access controls and other users’ workspaces. Follow the equipment manufacturer’s instructions and applicable electrical safety requirements when installing or operating sensors.</p>
      </section>
      <section>
        <h2>Readings and alerts</h2>
        <p>Sentrix estimates expected readings and reports anomalies using available sensor data. Connectivity, calibration and gaps in data can affect readings and alerts. Verify readings independently before making maintenance or safety decisions.</p>
      </section>
      <section>
        <h2>Managing sensor history</h2>
        <p>Review the confirmation before deleting a sensor or archived history. Deletion permanently removes the associated telemetry, predictions and alerts described in the confirmation. Export telemetry first if you need to keep a copy.</p>
      </section>
      <p>See the <Link href="/privacy">Privacy Policy</Link> for how Sentrix handles account and sensor data.</p>
    </>
  );
}

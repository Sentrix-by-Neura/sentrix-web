import type { Metadata } from "next";
import Link from "next/link";
import { T } from "../../lib/language-context";

export const metadata: Metadata = { title: "Terms of Service | Sentrix" };

export default function TermsPage() {
  return (
    <>
      <h1><T>Terms of Service</T></h1>
      <p><T>These terms apply when you create an account or use Sentrix to monitor electrical equipment.</T></p>
      <section>
        <h2><T>Accounts and equipment</T></h2>
        <p><T>Provide accurate account information and keep your sign-in and device setup credentials private. Only connect sensors, equipment and networks that you own or have permission to monitor.</T></p>
      </section>
      <section>
        <h2><T>Using Sentrix</T></h2>
        <p><T>Use Sentrix for authorized monitoring and maintenance. Respect access controls and other users’ workspaces. Follow the equipment manufacturer’s instructions and applicable electrical safety requirements when installing or operating sensors.</T></p>
      </section>
      <section>
        <h2><T>Readings and alerts</T></h2>
        <p><T>Sentrix estimates expected readings and reports anomalies using available sensor data. Connectivity, calibration and gaps in data can affect readings and alerts. Verify readings independently before making maintenance or safety decisions.</T></p>
      </section>
      <section>
        <h2><T>Managing sensor history</T></h2>
        <p><T>Review the confirmation before deleting a sensor or archived history. Deletion permanently removes the associated telemetry, predictions and alerts described in the confirmation. Export telemetry first if you need to keep a copy.</T></p>
      </section>
      <p><T>See the</T> <Link href="/privacy"><T>Privacy Policy</T></Link> <T>for how Sentrix handles account and sensor data.</T></p>
    </>
  );
}

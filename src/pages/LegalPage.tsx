import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONTACT_EMAIL = 'support@fagsallday.com';
const UPDATED = 'November 1, 2026';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

const Shell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground mt-1">Last updated {UPDATED}</p>
        </div>
        {children}
      </div>
    </div>
  );
};

export const PrivacyPolicy: React.FC = () => (
  <Shell title="Privacy Policy">
    <Section title="Overview">
      <p>FAGsAllDay is a golf scorekeeping, handicap tracking, and game calculation app. This policy explains what information we collect and how we use it.</p>
    </Section>
    <Section title="Information we collect">
      <ul className="list-disc pl-5 space-y-1">
        <li>Account details: name, email address, and password (stored securely, never visible to us).</li>
        <li>Golf information: handicap index, GHIN number (if you link it), scores, rounds, courses, games, and saved players.</li>
        <li>Tournament registration details you submit, such as phone number.</li>
        <li>Scorecard photos you choose to upload, used only to read course hole data.</li>
        <li>Your approximate location, only when you choose to search for nearby courses.</li>
      </ul>
    </Section>
    <Section title="How we use it">
      <p>We use your information to run the app: keeping score, calculating game results and settlements, syncing handicaps, running tournaments, and sharing rounds with the players you play with. We do not sell your information or use it for advertising.</p>
    </Section>
    <Section title="Sharing">
      <p>Your name, handicap, and scores are visible to other players in rounds and tournaments you join. We use service providers to host data, send email, look up handicaps from the GHIN service, and read uploaded scorecards. Tournament organizers may sync registration details to their own spreadsheet.</p>
    </Section>
    <Section title="No real-money gambling">
      <p>The app only calculates game results between players. No money is collected, held, or transferred through the app.</p>
    </Section>
    <Section title="Deleting your account">
      <p>You can delete your account at any time from Profile → Delete Account. This permanently removes your account, profile, rounds, saved players, and saved courses. Scores you recorded in other people's rounds or tournaments may remain in their records under your name.</p>
    </Section>
    <Section title="Children">
      <p>The app is not intended for children under 13, and we do not knowingly collect their information.</p>
    </Section>
    <Section title="Contact">
      <p>Questions? Email <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </Section>
  </Shell>
);

export const TermsOfService: React.FC = () => (
  <Shell title="Terms of Service">
    <Section title="Using the app">
      <p>By using FAGsAllDay you agree to these terms. You are responsible for your account and for the accuracy of the scores and information you enter.</p>
    </Section>
    <Section title="Scorekeeping only — no gambling">
      <p>FAGsAllDay is a scorekeeping and game calculation tool. No real-money gambling, wagering, or financial transactions take place within the app. Any amounts shown are informational tallies; any arrangements between players happen outside the app and are solely their responsibility and must follow local laws.</p>
    </Section>
    <Section title="Acceptable use">
      <p>Don't misuse the app, access other people's accounts, or upload content you don't have the right to share.</p>
    </Section>
    <Section title="Handicaps and results">
      <p>Handicap data and game calculations are provided as-is. Official handicaps are maintained by your golf association.</p>
    </Section>
    <Section title="Ending your account">
      <p>You can delete your account at any time from your Profile. We may suspend accounts that violate these terms.</p>
    </Section>
    <Section title="Disclaimer">
      <p>The app is provided "as is" without warranties. To the extent allowed by law, we are not liable for indirect damages arising from its use.</p>
    </Section>
    <Section title="Contact">
      <p>Questions? Email <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </Section>
  </Shell>
);

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface WeeklyDigestProps {
  brandName: string;
  visibility: number | null;
  visibilityDelta: number | null;
  shareOfVoice: number | null;
  topCompetitors: Array<{ name: string; count: number }>;
  appUrl: string;
}

export default function WeeklyDigest({
  brandName,
  visibility,
  visibilityDelta,
  shareOfVoice,
  topCompetitors,
  appUrl,
}: WeeklyDigestProps) {
  const deltaText =
    visibilityDelta === null
      ? ""
      : visibilityDelta >= 0
        ? ` (+${visibilityDelta} vs last week)`
        : ` (${visibilityDelta} vs last week)`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {brandName}: AI visibility {String(visibility ?? "—")}/100{deltaText}
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#fafafa", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 32, maxWidth: 520 }}>
          <Heading as="h2">Your AI week — {brandName}</Heading>

          <Section>
            <Text style={{ fontSize: 40, fontWeight: 700, margin: "8px 0" }}>
              {visibility ?? "—"}<span style={{ fontSize: 16, fontWeight: 400 }}> / 100{deltaText}</span>
            </Text>
            <Text style={{ color: "#555" }}>
              Visibility score inside AI answers
              {shareOfVoice !== null ? ` · Share of voice: ${shareOfVoice}%` : ""}
            </Text>
          </Section>

          {topCompetitors.length > 0 && (
            <>
              <Hr />
              <Section>
                <Text style={{ fontWeight: 600 }}>Who the AIs cite on your questions:</Text>
                {topCompetitors.map((c) => (
                  <Text key={c.name} style={{ margin: "4px 0", color: "#333" }}>
                    • {c.name} — {c.count} mention{c.count > 1 ? "s" : ""}
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr />
          <Text>
            <Link href={`${appUrl}/dashboard`}>See the details on your dashboard →</Link>
          </Text>
          <Text style={{ color: "#999", fontSize: 12 }}>
            Mentio — your brand, tracked inside AI answers.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

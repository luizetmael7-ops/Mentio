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
import type { PlannedAction } from "@/lib/action-plan";

/**
 * Le digest hebdomadaire — la seule surface qui arrive chez le client sans qu'il
 * se connecte, et donc la seule qui décide s'il se reconnecte.
 *
 * Il ne portait que des chiffres : score, part de voix, concurrents. Or un score
 * connu donne le sentiment que le travail est fait — c'est exactement comme ça
 * que meurent les outils de cette catégorie. L'action passe donc AVANT les
 * concurrents, et elle est la promesse vendue sur le palier Brand.
 *
 * Écrit en français : le produit l'est, les clients aussi.
 */
export interface WeeklyDigestProps {
  brandName: string;
  visibility: number | null;
  visibilityDelta: number | null;
  shareOfVoice: number | null;
  topCompetitors: Array<{ name: string; count: number }>;
  /** L'action du jour — la première du plan, celle qui a le plus d'effet attendu */
  action?: PlannedAction | null;
  /**
   * Le dépassement nominatif, s'il y en a un. Placé tout en haut : c'est la
   * seule ligne de cet email qui désigne un responsable et une question, donc
   * la seule qui appelle une réaction immédiate.
   */
  overtake?: string | null;
  /**
   * Le franchissement de palier. Placé au-dessus de tout : c'est l'événement qui
   * installe le vocabulaire du barème dans la bouche du client.
   */
  tierChange?: string | null;
  tierChangeTitle?: string | null;
  /** « 4 relevés consécutifs en hausse » — un fait mesuré, pas un encouragement */
  streak?: string | null;
  appUrl: string;
}

export default function WeeklyDigest({
  brandName,
  visibility,
  visibilityDelta,
  shareOfVoice,
  topCompetitors,
  action,
  overtake,
  tierChange,
  tierChangeTitle,
  streak,
  appUrl,
}: WeeklyDigestProps) {
  const deltaText =
    visibilityDelta === null
      ? ""
      : visibilityDelta >= 0
        ? ` (+${visibilityDelta} vs semaine dernière)`
        : ` (${visibilityDelta} vs semaine dernière)`;

  return (
    <Html lang="fr">
      <Head />
      {/* L'aperçu de la boîte de réception : l'action y passe avant le score,
          c'est elle qui fait ouvrir. */}
      <Preview>
        {tierChangeTitle
          ? tierChangeTitle
          : overtake
          ? overtake
          : action
          ? `${brandName} — à faire cette semaine : ${action.title}`
          : `${brandName} — visibilité IA ${String(visibility ?? "—")}/100${deltaText}`}
      </Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#fafafa", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 32, maxWidth: 520 }}>
          <Heading as="h2">Votre semaine IA — {brandName}</Heading>

          {/* Le franchissement de palier — sobre : on nomme le fait et on le date,
              sans félicitations. Un institut de mesure qui congratule comme une
              application de fitness perd ce qui fait sa valeur. */}
          {tierChange && (
            <Section
              style={{
                border: "1px solid #171520",
                padding: "14px 16px",
                margin: "12px 0 20px",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#544F60",
                }}
              >
                Changement de palier
              </Text>
              <Text style={{ margin: "6px 0 0", fontWeight: 700, color: "#171520" }}>
                {tierChangeTitle}
              </Text>
              <Text style={{ margin: "6px 0 0", color: "#333", lineHeight: 1.5 }}>{tierChange}</Text>
              {streak ? (
                <Text style={{ margin: "8px 0 0", fontSize: 13, color: "#544F60" }}>{streak}</Text>
              ) : null}
            </Section>
          )}

          {/* Le dépassement, avant tout le reste. C'est la seule ligne qui
              nomme un responsable et une question. */}
          {overtake && (
            <Section
              style={{
                borderLeft: "4px solid #E8462B",
                backgroundColor: "#fdf3f1",
                padding: "12px 16px",
                margin: "12px 0 20px",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#E8462B",
                }}
              >
                Une place a changé de main
              </Text>
              <Text style={{ margin: "6px 0 0", color: "#171520", lineHeight: 1.5 }}>{overtake}</Text>
            </Section>
          )}

          <Section>
            <Text style={{ fontSize: 40, fontWeight: 700, margin: "8px 0" }}>
              {visibility ?? "—"}
              <span style={{ fontSize: 16, fontWeight: 400 }}> / 100{deltaText}</span>
            </Text>
            <Text style={{ color: "#555" }}>
              Score de visibilité dans les réponses d&apos;IA
              {shareOfVoice !== null ? ` · Part de voix : ${shareOfVoice} %` : ""}
            </Text>
          </Section>

          {action && (
            <>
              <Hr />
              <Section
                style={{
                  backgroundColor: "#f6f4fa",
                  borderLeft: "4px solid #E8462B",
                  borderRadius: 6,
                  padding: "16px 18px",
                }}
              >
                <Text
                  style={{
                    margin: 0,
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#544F60",
                  }}
                >
                  L&apos;action de la semaine
                </Text>
                <Text style={{ margin: "8px 0 4px", fontWeight: 700, fontSize: 17 }}>
                  {action.title}
                </Text>
                <Text style={{ margin: 0, color: "#333", lineHeight: 1.5 }}>{action.detail}</Text>
              </Section>
            </>
          )}

          {topCompetitors.length > 0 && (
            <>
              <Hr />
              <Section>
                <Text style={{ fontWeight: 600 }}>Qui les IA citent sur vos questions :</Text>
                {topCompetitors.map((c) => (
                  <Text key={c.name} style={{ margin: "4px 0", color: "#333" }}>
                    • {c.name} — {c.count} citation{c.count > 1 ? "s" : ""}
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr />
          <Text>
            <Link href={`${appUrl}/dashboard`}>Voir le détail sur votre tableau de bord →</Link>
          </Text>
          <Text style={{ color: "#999", fontSize: 12 }}>
            Mentio — votre marque, mesurée dans les réponses d&apos;IA.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

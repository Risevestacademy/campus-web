import chooseHowYouShowUp from "@/assets/landing-page/choose-how-you-show-up.svg";
import chooseHowYouShowUpDark from "@/assets/landing-page/choose-how-you-show-up-dark.svg";
import safetyControls from "@/assets/landing-page/safety-controls.svg";
import stepAwayDark from "@/assets/landing-page/step-away-when-you-need-to-dark.svg";
import talkWhereYouAre from "@/assets/landing-page/talk-where-you-are.svg";
import talkWhereYouAreDark from "@/assets/landing-page/talk-where-you-are-dark.svg";
import { ThemedImage } from "@/shared/ui/themed-image";

const featureCards = [
  {
    title: "Talk where you are",
    description:
      "Speak with people nearby or with everyone inside your room. Room conversations stay within that space.",
    illustration: <ConversationIllustration />,
  },
  {
    title: "Choose how you show up",
    description:
      "Control your camera and microphone. Set yourself to Available, Busy, Do Not Disturb or Away.",
    illustration: <AvailabilityIllustration />,
  },
  {
    title: "Step away when you need to",
    description:
      "Leave an interaction, block a user or report a concern using the controls in Campus.",
    illustration: <SafetyIllustration />,
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="content-grid scroll-mt-22 bg-[#EFFAFF] pt-24 pb-20 font-sans md:scroll-mt-28 dark:bg-[#1F2940]"
    >
      <div className="w-full">
        <header className="mx-auto max-w-[900px] text-center">
          <h2
            id="features-heading"
            className="font-display text-foreground text-[40px] leading-[44px] font-semibold tracking-[-0.02em] sm:text-[56px] sm:leading-[60px]"
          >
            <span className="block">Connection, with</span>
            <span className="block">room to breathe.</span>
          </h2>

          <p className="text-foreground-secondary mx-auto mt-7 max-w-[760px] text-lg leading-[160%] dark:text-[#abb9d8]">
            A question after class. A catch-up at someone’s desk. A mentoring
            session in a private room. Campus gives those conversations a place,
            with controls for when you’re ready to join in.
          </p>
        </header>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map(({ title, description, illustration }) => (
            <li key={title}>
              <article className="dark:text-foreground flex h-full flex-col gap-[18px] rounded-2xl bg-neutral-50 p-6 text-neutral-950 transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm dark:bg-[#2b3b5f]/50">
                <figure
                  aria-hidden="true"
                  className="mx-auto h-[190px] w-full overflow-hidden rounded-xl"
                >
                  {illustration}
                </figure>

                <h3 className="font-display text-foreground text-2xl leading-[130%] font-semibold tracking-[-0.005em]">
                  {title}
                </h3>

                <p className="text-foreground-secondary text-base leading-[160%] dark:text-[#abb9d8]">
                  {description}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ConversationIllustration() {
  return (
    <ThemedImage
      light={talkWhereYouAre}
      dark={talkWhereYouAreDark}
      alt=""
      width={320}
      height={190}
      className="size-full object-cover"
    />
  );
}

function AvailabilityIllustration() {
  return (
    <ThemedImage
      light={chooseHowYouShowUp}
      dark={chooseHowYouShowUpDark}
      alt=""
      width={363}
      height={190}
      className="size-full object-cover"
    />
  );
}

function SafetyIllustration() {
  return (
    <ThemedImage
      light={safetyControls}
      dark={stepAwayDark}
      alt=""
      width={363}
      height={190}
      className="size-full object-cover"
    />
  );
}

import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const fontVariableClasses = `${bricolageGrotesque.variable} ${instrumentSans.variable}`;

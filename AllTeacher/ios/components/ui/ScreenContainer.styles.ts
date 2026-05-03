import { StyleSheet } from "react-native";

import { colors } from "@/lib/theme";

export const screenContainerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  bgGradient: { ...StyleSheet.absoluteFillObject, height: 320 },
  safe: { flex: 1 },
});

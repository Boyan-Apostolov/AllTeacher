import { StyleSheet } from "react-native";
import { colors } from "@/lib/theme";

export const bottomTabStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.ink,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  activeBar: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 3,
    backgroundColor: colors.brand,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  label: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  labelActive: {
    color: colors.brand,
  },
  labelInactive: {
    color: colors.ink3,
  },
});

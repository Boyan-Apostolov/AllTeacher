/**
 * One row in the home-screen curriculum list. Owns the icon + title +
 * status badge + progress bar + remove button — all the visual chrome
 * for a single curriculum.
 */
import { Pressable, Text, View } from "react-native";

import type { CurriculumListItem } from "@/lib/api";
import {
  curriculumProgress,
  domainEmoji,
  statusBadge,
} from "@/lib/curriculum";
import { shadow } from "@/lib/theme";
import { ProgressBar, StatusPill } from "@/components/ui";

import { curriculumRowStyles as styles } from "./CurriculumRow.styles";

export function CurriculumRow({
  item,
  onOpen,
  onRemove,
}: {
  item: CurriculumListItem;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const badge = statusBadge(item);
  const emoji = domainEmoji(item.domain);
  const { pct, stepLabel, barColor } = curriculumProgress(item);

  return (
    <View style={[styles.row, shadow.card]}>
      <Pressable style={styles.body} onPress={onOpen}>
        <View style={styles.topRow}>
          <View style={styles.icon}>
            <Text style={styles.iconEmoji}>{emoji}</Text>
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={2}>
              {item.goal || item.topic || "Untitled"}
            </Text>
            <View style={styles.metaRow}>
              <StatusPill
                label={badge.badge}
                bg={badge.badgeBg}
                fg={badge.badgeFg}
              />
              {item.level ? (
                <Text style={styles.meta}>· {item.level}</Text>
              ) : null}
              {item.domain ? (
                <Text style={styles.meta}>· {item.domain}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.progressStepLabel}>{stepLabel}</Text>
          <ProgressBar pct={pct} color={barColor} />
        </View>
      </Pressable>

      <Pressable
        style={styles.removeBtn}
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel="Remove curriculum"
      >
        <Text style={styles.removeBtnText}>×</Text>
      </Pressable>
    </View>
  );
}

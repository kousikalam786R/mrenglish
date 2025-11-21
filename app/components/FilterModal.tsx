import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  PanResponder
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterSettings) => void;
  initialFilters?: FilterSettings;
}

export interface FilterSettings {
  gender: 'all' | 'male' | 'female';
  ratingMin: number;
  ratingMax: number;
  levelMin: number; // Index in levels array (0-5 for A1-C2)
  levelMax: number; // Index in levels array (0-5 for A1-C2)
  levels: string[];
}

const FilterModal = ({ visible, onClose, onApply, initialFilters }: FilterModalProps) => {
  const { theme } = useTheme();
  const [gender, setGender] = useState<'all' | 'male' | 'female'>(
    initialFilters?.gender || 'all'
  );
  const [ratingMin, setRatingMin] = useState(initialFilters?.ratingMin || 0);
  const [ratingMax, setRatingMax] = useState(initialFilters?.ratingMax || 100);
  const [levelMin, setLevelMin] = useState(initialFilters?.levelMin || 0);
  const [levelMax, setLevelMax] = useState(initialFilters?.levelMax || 5);

  const englishLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  
  // Get selected levels based on range
  const selectedLevels = englishLevels.slice(levelMin, levelMax + 1);

  const getLevelHeight = (index: number) => {
    // Create different heights for visual effect
    const heights: { [key: number]: number } = {
      0: 20,   // A1
      1: 25,   // A2
      2: 50,   // B1
      3: 70,   // B2
      4: 60,   // C1
      5: 40,   // C2
    };
    return heights[index] || 30;
  };

  const getLevelColor = (index: number) => {
    // Check if this level is within the selected range
    if (index >= levelMin && index <= levelMax) {
      return theme.primary; // Primary color
    }
    return theme.divider; // Divider color for unselected
  };

  const handleRatingMinChange = (value: number) => {
    console.log('handleRatingMinChange called with:', value, 'current:', ratingMin);
    const newMin = Math.max(0, Math.min(value, ratingMax - 1));
    console.log('Setting ratingMin to:', newMin);
    setRatingMin(newMin);
    console.log('ratingMin state after set:', ratingMin);
  };

  const handleRatingMaxChange = (value: number) => {
    console.log('handleRatingMaxChange called with:', value, 'current:', ratingMax);
    const newMax = Math.max(ratingMin + 1, Math.min(value, 100));
    console.log('Setting ratingMax to:', newMax);
    setRatingMax(newMax);
    console.log('ratingMax state after set:', ratingMax);
  };

  const handleLevelMinChange = (index: number) => {
    setLevelMin(Math.max(0, Math.min(index, levelMax)));
  };

  const handleLevelMaxChange = (index: number) => {
    setLevelMax(Math.max(levelMin, Math.min(index, englishLevels.length - 1)));
  };

  const handleApply = () => {
    onApply({
      gender,
      ratingMin,
      ratingMax,
      levelMin,
      levelMax,
      levels: selectedLevels
    });
    onClose();
  };

  const dynamicStyles = {
    overlay: { backgroundColor: theme.overlay },
    modal: { backgroundColor: theme.card },
    header: { borderBottomColor: theme.border },
    title: { color: theme.text },
    closeButtonText: { color: theme.textSecondary },
    sectionTitle: { color: theme.text },
    ratingRange: { color: theme.textSecondary },
    levelLabel: { color: theme.textSecondary },
    sliderLabel: { color: theme.text },
    pill: {
      backgroundColor: theme.card,
      borderColor: theme.border,
    },
    pillActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    pillText: { color: theme.textSecondary },
    pillTextActive: { color: '#FFFFFF' },
    sliderTrack: { backgroundColor: theme.divider },
    sliderActiveTrack: { backgroundColor: theme.primary },
    sliderThumb: {
      backgroundColor: theme.primary,
      borderColor: theme.card,
    },
    sliderButton: {
      backgroundColor: theme.primary,
      shadowColor: theme.shadow,
    },
    applyButton: { backgroundColor: theme.primary },
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, dynamicStyles.overlay]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modal, dynamicStyles.modal]}>
              <View style={[styles.header, dynamicStyles.header]}>
                <Text style={[styles.title, dynamicStyles.title]}>Find a partner</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={[styles.closeButtonText, dynamicStyles.closeButtonText]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Gender Filter */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Gender</Text>
                  <View style={styles.pillContainer}>
                    <TouchableOpacity
                      style={[
                        styles.pill, 
                        dynamicStyles.pill,
                        gender === 'all' && [styles.pillActive, dynamicStyles.pillActive]
                      ]}
                      onPress={() => setGender('all')}
                    >
                      <Text style={[
                        styles.pillText, 
                        dynamicStyles.pillText,
                        gender === 'all' && [styles.pillTextActive, dynamicStyles.pillTextActive]
                      ]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pill, 
                        dynamicStyles.pill,
                        gender === 'male' && [styles.pillActive, dynamicStyles.pillActive]
                      ]}
                      onPress={() => setGender('male')}
                    >
                      <Text style={[
                        styles.pillText, 
                        dynamicStyles.pillText,
                        gender === 'male' && [styles.pillTextActive, dynamicStyles.pillTextActive]
                      ]}>
                        Male
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.pill, 
                        dynamicStyles.pill,
                        gender === 'female' && [styles.pillActive, dynamicStyles.pillActive]
                      ]}
                      onPress={() => setGender('female')}
                    >
                      <Text style={[
                        styles.pillText, 
                        dynamicStyles.pillText,
                        gender === 'female' && [styles.pillTextActive, dynamicStyles.pillTextActive]
                      ]}>
                        Female
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Rating Filter */}
                <View style={styles.section}>
                  <View style={styles.ratingHeader}>
                    <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Rating</Text>
                    <Text style={[styles.ratingRange, dynamicStyles.ratingRange]}>
                      {ratingMin}-{ratingMax}% 👍
                    </Text>
                  </View>
                  
                  {/* Rating Slider with Buttons */}
                  <View style={styles.sliderContainer}>
                    <View style={[styles.sliderTrack, dynamicStyles.sliderTrack]}>
                      <View style={[
                        styles.sliderActiveTrack, 
                        dynamicStyles.sliderActiveTrack,
                        { 
                          left: `${ratingMin}%`, 
                          width: `${ratingMax - ratingMin}%` 
                        }
                      ]} />
                      <TouchableOpacity
                        style={[
                          styles.sliderThumb, 
                          dynamicStyles.sliderThumb,
                          { left: `${ratingMin}%` }
                        ]}
                        onPress={() => {
                          const newValue = ratingMin > 0 ? ratingMin - 10 : 0;
                          console.log('Min thumb pressed, new value:', newValue);
                          handleRatingMinChange(newValue);
                        }}
                      />
                      <TouchableOpacity
                        style={[
                          styles.sliderThumb, 
                          dynamicStyles.sliderThumb,
                          { left: `${ratingMax}%` }
                        ]}
                        onPress={() => {
                          const newValue = ratingMax < 100 ? ratingMax + 10 : 100;
                          console.log('Max thumb pressed, new value:', newValue);
                          handleRatingMaxChange(newValue);
                        }}
                      />
                    </View>
                    <View style={styles.sliderButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.sliderButton, dynamicStyles.sliderButton]}
                        onPress={() => {
                          console.log('Min button pressed, current:', ratingMin);
                          handleRatingMinChange(Math.max(0, ratingMin - 10));
                        }}
                      >
                        <Text style={styles.sliderButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={[styles.sliderLabel, dynamicStyles.sliderLabel]}>Range: {ratingMin}-{ratingMax}%</Text>
                      <TouchableOpacity 
                        style={[styles.sliderButton, dynamicStyles.sliderButton]}
                        onPress={() => {
                          console.log('Max button pressed, current:', ratingMax);
                          handleRatingMaxChange(Math.min(100, ratingMax + 10));
                        }}
                      >
                        <Text style={styles.sliderButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* English Level Filter */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>English level</Text>
                  
                  {/* English Level Bars - Clickable */}
                  <View style={styles.levelContainer}>
                    {englishLevels.map((level, index) => (
                      <TouchableOpacity
                        key={level}
                        style={styles.levelColumn}
                        onPress={() => {
                          // Toggle this level by adjusting range
                          if (index < levelMin) {
                            handleLevelMinChange(index);
                          } else if (index > levelMax) {
                            handleLevelMaxChange(index);
                          } else {
                            // If clicking within range, toggle the edge
                            const distanceFromMin = Math.abs(index - levelMin);
                            const distanceFromMax = Math.abs(index - levelMax);
                            if (distanceFromMin < distanceFromMax) {
                              handleLevelMinChange(index + 1);
                            } else {
                              handleLevelMaxChange(index - 1);
                            }
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.levelBar,
                            {
                              height: getLevelHeight(index),
                              backgroundColor: getLevelColor(index)
                            }
                          ]}
                        />
                        <Text style={[styles.levelLabel, dynamicStyles.levelLabel]}>{level}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {/* Level Range Slider with Buttons */}
                  <View style={styles.sliderContainer}>
                    <View style={[styles.sliderTrack, dynamicStyles.sliderTrack]}>
                      <View style={[
                        styles.sliderActiveTrack, 
                        dynamicStyles.sliderActiveTrack,
                        { 
                          left: `${(levelMin / 5) * 100}%`, 
                          width: `${((levelMax - levelMin) / 5) * 100}%` 
                        }
                      ]} />
                    </View>
                    <View style={styles.sliderButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.sliderButton, dynamicStyles.sliderButton]}
                        onPress={() => {
                          const newMin = Math.max(0, levelMin - 1);
                          handleLevelMinChange(newMin);
                        }}
                      >
                        <Text style={styles.sliderButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={[styles.sliderLabel, dynamicStyles.sliderLabel]}>
                        {englishLevels[levelMin]} to {englishLevels[levelMax]}
                      </Text>
                      <TouchableOpacity 
                        style={[styles.sliderButton, dynamicStyles.sliderButton]}
                        onPress={() => {
                          const newMax = Math.min(englishLevels.length - 1, levelMax + 1);
                          handleLevelMaxChange(newMax);
                        }}
                      >
                        <Text style={styles.sliderButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Apply Button */}
              <TouchableOpacity style={[styles.applyButton, dynamicStyles.applyButton]} onPress={handleApply}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pillContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillActive: {
    // Colors applied via dynamicStyles
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextActive: {
    fontWeight: '600',
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingRange: {
    fontSize: 14,
    fontWeight: '500',
  },
  ratingInfo: {
    padding: 12,
    borderRadius: 8,
  },
  ratingInfoText: {
    fontSize: 14,
  },
  levelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    marginTop: 20,
  },
  levelColumn: {
    alignItems: 'center',
  },
  levelBar: {
    width: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sliderContainer: {
    marginTop: 20,
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    position: 'relative',
  },
  sliderActiveTrack: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    top: -6,
    marginLeft: -10,
  },
  sliderButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  sliderButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sliderButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  applyButton: {
    margin: 20,
    marginTop: 10,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FilterModal;

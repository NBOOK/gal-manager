<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  fillPercentage: {
    type: Number,
    default: 0,
    validator: (value: number) => value >= 0 && value <= 1,
  },
});

const [x, y, w, h] = [1, 4, 22, 16];

const fillHeight = computed(() => h * (0.13 + props.fillPercentage * 0.75));
const fillY = computed(() => y + h - fillHeight.value); // 从底部开始填充

const fillColor = computed(() =>
  props.fillPercentage < 0.5
    ? "#4EAF54"
    : props.fillPercentage < 0.8
    ? "#FEC02A"
    : props.fillPercentage < 0.9
    ? "#F88133"
    : "#F2413C"
);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="`${x} ${y} ${w} ${h}`"
    style="height: 16px"
  >
    <defs>
      <mask id="fill-mask-cloud">
        <rect :x="x" :y="y" :width="w" :height="h" fill="black" />
        <path
          d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20Z"
          fill="white"
        />
      </mask>
    </defs>

    <!-- 填充层 -->
    <rect
      :x="x"
      :y="fillY"
      :width="w"
      :height="fillHeight"
      :fill="fillColor"
      mask="url(#fill-mask-cloud)"
    />

    <!-- 原始图标 -->
    <path
      d="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20M6.5 18H18.5Q19.55 18 20.27 17.27 21 16.55 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 8.93 15.54 7.46 14.08 6 12 6 9.93 6 8.46 7.46 7 8.93 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18M12 12Z"
      fill="currentColor"
    />
  </svg>
</template>

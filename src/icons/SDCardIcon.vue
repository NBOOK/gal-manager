<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  fillPercentage: {
    type: Number,
    default: 0,
    validator: (value: number) => value >= 0 && value <= 1,
  },
});

const [x, y, w, h] = [85.333333, 0, 853.333334, 1024];

const fillHeight = computed(() => h * (0.09 + props.fillPercentage * 0.83));
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
      <mask id="fill-mask-micro-sd">
        <rect :x="x" :y="y" :width="w" :height="h" fill="black" />
        <path
          d="M297.984 0C228.181333 0 170.496 57.173333 169.984 126.976l-2.56 325.034667-70.229333 73.130666A42.666667 42.666667 0 0 0 85.333333 554.666667v341.333333c0 70.229333 57.770667 128 128 128h597.333334c70.229333 0 128-57.770667 128-128v-768C938.666667 57.770667 880.896 0 810.666667 0H297.984z"
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
      mask="url(#fill-mask-micro-sd)"
    />

    <!-- 原始图标 -->
    <path
      d="M297.984 0C228.181333 0 170.496 57.173333 169.984 126.976l-2.56 325.034667-70.229333 73.130666A42.666667 42.666667 0 0 0 85.333333 554.666667v341.333333c0 70.229333 57.770667 128 128 128h597.333334c70.229333 0 128-57.770667 128-128v-768C938.666667 57.770667 880.896 0 810.666667 0H297.984z m0 85.333333H810.666667c23.978667 0 42.666667 18.688 42.666666 42.666667v768c0 23.978667-18.688 42.666667-42.666666 42.666667h-597.333334a42.069333 42.069333 0 0 1-42.666666-42.666667V571.818667l70.144-72.96a42.666667 42.666667 0 0 0 11.861333-29.184l2.645333-342.016a42.069333 42.069333 0 0 1 42.666667-42.325334zM341.333333 170.666667v170.666666h85.333334V170.666667H341.333333z m170.666667 0v170.666666h85.333333V170.666667H512z m170.666667 0v170.666666h85.333333V170.666667H682.666667z"
      fill="currentColor"
    />
  </svg>
</template>

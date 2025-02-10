<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  fillPercentage: {
    type: Number,
    default: 0,
    validator: (value: number) => value >= 0 && value <= 1,
  },
});

const [x, y, w, h] = [192, 128, 640, 832];

const fillHeight = computed(() => h * (0.08 + props.fillPercentage * 0.85));
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
      <mask id="fill-mask-usb">
        <rect :x="x" :y="y" :width="w" :height="h" fill="black" />
        <path
          d="M256 512V160a32 32 0 0 1 32-32h448a32 32 0 0 1 32 32V512a64 64 0 0 1 64 64v320a64 64 0 0 1-64 64H256a64 64 0 0 1-64-64V576a64 64 0 0 1 64-64z"
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
      mask="url(#fill-mask-usb)"
    />

    <!-- 原始图标 -->
    <path
      fill="currentColor"
      d="M480 384h-128V320h128v64zM544 384h128V320h-128v64z"
    />
    <path
      fill="currentColor"
      d="M256 512V160a32 32 0 0 1 32-32h448a32 32 0 0 1 32 32V512a64 64 0 0 1 64 64v320a64 64 0 0 1-64 64H256a64 64 0 0 1-64-64V576a64 64 0 0 1 64-64z m64 0h384V192H320v320zM256 576v320h512V576H256z"
    />
  </svg>
</template>

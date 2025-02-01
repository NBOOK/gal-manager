<script setup lang="ts">
  // import { reactive, computed } from "vue";
  import GameEntry from "@/modules/GameEntry";
  import GameImgThumb from "@/components/GameImgThumb.vue";
  import GameInfo from "@/components/GameInfo.vue";
  import ControlGroup from "@/components/ControlGroup.vue";

  defineProps<{ game: GameEntry }>(); // use props.game to access the game object
</script>

<template>
  <!-- <div class="game-item"> -->
  <v-sheet
    rounded="lg"
    elevation="3"
    height="100"
    style="margin: 5px 0"
    min-width="550px"
    @contextmenu="game.selected = !game.selected"
  >
    <div class="game-item">
      <!-- 左侧图片 -->
      <GameImgThumb :game="game" />

      <!-- 中间内容 -->
      <GameInfo :game="game" />

      <!-- 右侧按钮 -->
      <ControlGroup :game="game" />
    </div>
  </v-sheet>
</template>

<style scoped>
  .game-item {
    display: flex;
    align-items: flex-start;
    max-width: 100%;
    flex-wrap: nowrap;
  }
</style>

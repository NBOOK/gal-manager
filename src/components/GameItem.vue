<script setup lang="ts">
// import { reactive, computed } from "vue";
import GameEntry from "@/modules/GameEntry";
import GameImgThumb from "@/components/GameImgThumb.vue";
import GameInfo from "@/components/GameInfo.vue";
import ControlGroup from "@/components/ControlGroup.vue";

defineProps<{ game: GameEntry }>(); // use props.game to access the game object
</script>

<template>
  <v-sheet
    rounded="lg"
    elevation="3"
    height="100"
    style="margin: 5px 0"
    min-width="550px"
    @contextmenu.prevent="game.selected = !game.selected"
  >
    <div class="game-item">
      <!-- 左侧图片 -->
      <v-col class="flex-grow-0 pa-0">
        <div class="game-image">
          <v-img
            v-if="game.imageAssets.paths.headerSD"
            rounded
            :src="`file://${game.imageAssets.paths.headerSD}`"
          >
            <GameImgThumb :game="game" />
          </v-img>
          <div v-else class="game-image-placeholder"></div>
        </div>
      </v-col>

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

.game-image {
  height: 100px;
  border-radius: 5px;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}

.game-image .v-img {
  height: 100px;
  object-fit: cover;
  border-radius: 5px;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
  cursor: pointer;
}

.game-image-placeholder {
  height: 100px;
  border-radius: 5px;
  background-color: #f0f0f0;
  margin-right: 10px;
  aspect-ratio: 92 / 43;
}
</style>

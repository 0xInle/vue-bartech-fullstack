<template>
  <div class="card container">
    <h2 class="card-title">Амирани</h2>
    <div class="card-content">
      <div class="card-ingredient flex">
        <div class="card-ingredient-name">Иджеван Кизиловый</div>
        <div class="card-ingredient-ml">20</div>
      </div>
      <div class="card-ingredient flex">
        <div class="card-ingredient-name">Лимончелло Ди Капри</div>
        <div class="card-ingredient-ml">20</div>
      </div>
      <div class="card-ingredient flex">
        <div class="card-ingredient-name">Кордиал Фейхоа-Кардамон</div>
        <div class="card-ingredient-ml">40</div>
      </div>
      <div class="card-ingredient flex">
        <div class="card-ingredient-name">Цитрусовый Биттер</div>
        <div class="card-ingredient-ml">0.002</div>
      </div>
      <div class="card-ingredient flex">
        <div class="card-ingredient-name">Сухой Вермут</div>
        <div class="card-ingredient-ml">10</div>
      </div>
      <div class="card-ingredient-all flex">
        <div class="card-ingredient-all">80</div>
      </div>
    </div>
    <div class="card-subcontent flex">
      <div class="card-subcontent-descr">Рюмка</div>
      <div class="card-subcontent-descr">Без льда</div>
      <div class="card-subcontent-descr">Стир</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// import { useStore } from '@/stores/store'
// const card = {
//   name: "",
//   ingredients: [],
//   params: {
//     dishes: "",
//     ice: "",
//     method: "",
//   }
// }

// const store = useStore()
</script>

<style scoped>
.container {
  max-width: max-content;
}

.card {
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
}

.card-title {
  padding: 5px;
  margin: 0 0 20px;
  text-align: center;
  font-weight: 400;
  border-radius: 5px;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
}

.card-content {
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
}

.card-ingredient {
  justify-content: space-between;
  align-items: center;
}

.card-ingredient-all {
  justify-content: flex-end;
  margin-bottom: 10px;
}

.card-ingredient:not(:last-child) {
  border-bottom: 1px solid var(--black-color);
}

.card-ingredient:not(:last-child) {
  margin-bottom: 5px;
}

.card-ingredient-name {
  margin-right: 30px;
  font-size: 14px;
}

.card-ingredient-ml,
.card-ingredient-all {
  font-size: 12px;
}

.card-subcontent {
  justify-content: space-between;
}

.card-subcontent-descr {
  display: flex;
  justify-content: center;
  align-items: center; /* вертикальное центрирование */
  padding: 10px;
  min-width: 62px;
  min-height: 62px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgb(0 0 0 / 30%);
  font-size: 10px;
}
</style>

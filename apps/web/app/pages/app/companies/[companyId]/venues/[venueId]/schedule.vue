<script setup lang="ts">
defineOptions({ name: "SchedulePageRedirect" });

const route = useRoute();
await navigateTo(`/app/companies/${route.params.companyId}/venues/${route.params.venueId}/team`, {
  redirectCode: 302,
});
</script>
